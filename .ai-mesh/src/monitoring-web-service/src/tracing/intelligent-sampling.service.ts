/**
 * Intelligent Sampling Service for Enhanced OTEL Tracing
 * Task 4.3: Custom Trace Instrumentation Enhancement (Sprint 4)
 * 
 * Features:
 * - Business criticality-based sampling with cost optimization
 * - Performance-based adaptive sampling (higher sampling for slow requests)
 * - Error-based sampling (full tracing for error scenarios)
 * - Tenant-specific sampling strategies with data isolation
 * - Real-time sampling rate adjustment based on system load
 */

import * as api from '@opentelemetry/api';
import { Sampler, SamplingResult, SamplingDecision } from '@opentelemetry/sdk-trace-node';
import { Context, TraceFlags } from '@opentelemetry/api';
import { Attributes } from '@opentelemetry/api';
import { logger } from '../config/logger';
import { config } from '../config/environment';
import { BusinessProcess } from './business-trace.service';

// Sampling strategy types
export enum SamplingStrategy {
  ALWAYS = 'always',
  NEVER = 'never',
  BUSINESS_CRITICAL = 'business_critical',
  ERROR_BASED = 'error_based',
  PERFORMANCE_BASED = 'performance_based',
  TENANT_BASED = 'tenant_based',
  ADAPTIVE = 'adaptive',
  COST_OPTIMIZED = 'cost_optimized'
}

// Sampling configuration per business process
export interface BusinessProcessSamplingConfig {
  process: BusinessProcess;
  strategy: SamplingStrategy;
  baseRate: number;
  errorMultiplier: number;
  performanceThreshold: number;
  performanceMultiplier: number;
  maxSampleRate: number;
  minSampleRate: number;
}

// Tenant-specific sampling configuration
export interface TenantSamplingConfig {
  tenantId: string;
  tier: 'free' | 'basic' | 'premium' | 'enterprise';
  baseRate: number;
  priorityMultiplier: number;
  budgetLimit: number; // Max spans per hour
  currentUsage: number;
  resetTime: Date;
}

// Real-time system metrics for adaptive sampling
export interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  spanQueueSize: number;
  exportLatency: number;
  errorRate: number;
  requestRate: number;
  lastUpdated: Date;
}

// Sampling decision context
export interface SamplingContext {
  businessProcess?: BusinessProcess;
  tenantId?: string;
  userId?: string;
  errorExpected?: boolean;
  performanceExpected?: boolean;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  resourceIntensive?: boolean;
  securitySensitive?: boolean;
  revenueImpact?: boolean;
}

export class IntelligentSamplingService implements Sampler {
  private businessProcessConfigs: Map<BusinessProcess, BusinessProcessSamplingConfig> = new Map();
  private tenantConfigs: Map<string, TenantSamplingConfig> = new Map();
  private systemMetrics: SystemMetrics;
  private samplingHistory: Map<string, number[]> = new Map(); // For adaptive learning
  private lastConfigUpdate: Date = new Date();

  constructor() {
    this.initializeDefaultConfigs();
    this.systemMetrics = this.initializeSystemMetrics();
    this.startSystemMonitoring();
    this.startConfigRefresh();
  }

  /**
   * Main sampling decision method
   */
  shouldSample(
    context: Context,
    traceId: string,
    spanName: string,
    spanKind: api.SpanKind,
    attributes: Attributes,
    links: api.Link[]
  ): SamplingResult {
    try {
      // Extract sampling context from attributes
      const samplingContext = this.extractSamplingContext(attributes);
      
      // Determine sampling strategy based on context
      const strategy = this.determineSamplingStrategy(samplingContext, attributes);
      
      // Calculate sampling decision
      const decision = this.makeSamplingDecision(
        strategy,
        samplingContext,
        spanName,
        traceId,
        attributes
      );

      // Update sampling history for adaptive learning
      this.updateSamplingHistory(traceId, decision.decision === SamplingDecision.RECORD_AND_SAMPLED ? 1 : 0);

      // Log sampling decision for analysis
      this.logSamplingDecision(decision, strategy, samplingContext, spanName);

      return decision;

    } catch (error) {
      logger.error('Error in intelligent sampling decision', {
        error: (error as Error).message,
        spanName,
        traceId,
        fallback: 'default_sampling'
      });

      // Fallback to default sampling
      return {
        decision: Math.random() < 0.1 ? SamplingDecision.RECORD_AND_SAMPLED : SamplingDecision.NOT_RECORD,
        attributes: {},
        traceState: api.trace.createTraceState()
      };
    }
  }

  /**
   * Extract sampling context from span attributes
   */
  private extractSamplingContext(attributes: Attributes): SamplingContext {
    return {
      businessProcess: attributes['business.process'] as BusinessProcess,
      tenantId: attributes['tenant.id'] as string,
      userId: attributes['user.id'] as string,
      errorExpected: attributes['error.expected'] as boolean,
      performanceExpected: attributes['performance.expected'] as boolean,
      priority: attributes['business.priority'] as 'low' | 'medium' | 'high' | 'critical',
      resourceIntensive: attributes['performance.resource_intensive'] as boolean,
      securitySensitive: attributes['business.security_sensitive'] as boolean,
      revenueImpact: attributes['business.revenue_impact'] as boolean
    };
  }

  /**
   * Determine the appropriate sampling strategy
   */
  private determineSamplingStrategy(
    samplingContext: SamplingContext,
    attributes: Attributes
  ): SamplingStrategy {
    // Always sample critical operations
    if (samplingContext.priority === 'critical' || 
        samplingContext.securitySensitive || 
        samplingContext.revenueImpact) {
      return SamplingStrategy.ALWAYS;
    }

    // Error-based sampling
    if (samplingContext.errorExpected || 
        attributes['error.occurred'] ||
        attributes['http.status_code'] && Number(attributes['http.status_code']) >= 400) {
      return SamplingStrategy.ERROR_BASED;
    }

    // Performance-based sampling
    if (samplingContext.performanceExpected ||
        samplingContext.resourceIntensive ||
        attributes['operation.duration_ms'] && Number(attributes['operation.duration_ms']) > 1000) {
      return SamplingStrategy.PERFORMANCE_BASED;
    }

    // Business process specific sampling
    if (samplingContext.businessProcess) {
      const config = this.businessProcessConfigs.get(samplingContext.businessProcess);
      if (config) {
        return config.strategy;
      }
    }

    // Tenant-based sampling
    if (samplingContext.tenantId) {
      return SamplingStrategy.TENANT_BASED;
    }

    // Adaptive sampling based on system load
    if (this.shouldUseAdaptiveSampling()) {
      return SamplingStrategy.ADAPTIVE;
    }

    // Default cost-optimized sampling
    return SamplingStrategy.COST_OPTIMIZED;
  }

  /**
   * Make the actual sampling decision based on strategy
   */
  private makeSamplingDecision(
    strategy: SamplingStrategy,
    samplingContext: SamplingContext,
    spanName: string,
    traceId: string,
    attributes: Attributes
  ): SamplingResult {
    let samplingRate: number;
    const baseAttributes: Attributes = {
      'sampling.strategy': strategy,
      'sampling.intelligent': true
    };

    switch (strategy) {
      case SamplingStrategy.ALWAYS:
        samplingRate = 1.0;
        baseAttributes['sampling.reason'] = 'business_critical';
        break;

      case SamplingStrategy.NEVER:
        samplingRate = 0.0;
        baseAttributes['sampling.reason'] = 'excluded';
        break;

      case SamplingStrategy.ERROR_BASED:
        samplingRate = this.calculateErrorBasedSampling(samplingContext, attributes);
        baseAttributes['sampling.reason'] = 'error_scenario';
        break;

      case SamplingStrategy.PERFORMANCE_BASED:
        samplingRate = this.calculatePerformanceBasedSampling(samplingContext, attributes);
        baseAttributes['sampling.reason'] = 'performance_analysis';
        break;

      case SamplingStrategy.BUSINESS_CRITICAL:
        samplingRate = this.calculateBusinessCriticalSampling(samplingContext);
        baseAttributes['sampling.reason'] = 'business_importance';
        break;

      case SamplingStrategy.TENANT_BASED:
        samplingRate = this.calculateTenantBasedSampling(samplingContext.tenantId!);
        baseAttributes['sampling.reason'] = 'tenant_policy';
        break;

      case SamplingStrategy.ADAPTIVE:
        samplingRate = this.calculateAdaptiveSampling(samplingContext, traceId);
        baseAttributes['sampling.reason'] = 'system_adaptive';
        break;

      case SamplingStrategy.COST_OPTIMIZED:
      default:
        samplingRate = this.calculateCostOptimizedSampling(samplingContext);
        baseAttributes['sampling.reason'] = 'cost_optimization';
        break;
    }

    // Apply system load adjustments
    samplingRate = this.applySystemLoadAdjustments(samplingRate);

    // Add sampling rate to attributes
    baseAttributes['sampling.rate'] = samplingRate;
    baseAttributes['sampling.decision_time'] = Date.now();

    const decision = Math.random() < samplingRate ? 
      SamplingDecision.RECORD_AND_SAMPLED : 
      SamplingDecision.NOT_RECORD;

    return {
      decision,
      attributes: baseAttributes,
      traceState: api.trace.createTraceState().set('sampling_rate', samplingRate.toString())
    };
  }

  /**
   * Calculate error-based sampling rate
   */
  private calculateErrorBasedSampling(
    samplingContext: SamplingContext,
    attributes: Attributes
  ): number {
    let baseRate = 1.0; // Always sample errors

    // Reduce sampling for expected/handled errors
    if (attributes['error.handled'] === true) {
      baseRate = 0.8;
    }

    // Increase sampling for security-related errors
    if (samplingContext.securitySensitive) {
      baseRate = 1.0;
    }

    // Increase sampling for revenue-impacting errors
    if (samplingContext.revenueImpact) {
      baseRate = 1.0;
    }

    return Math.min(baseRate, 1.0);
  }

  /**
   * Calculate performance-based sampling rate
   */
  private calculatePerformanceBasedSampling(
    samplingContext: SamplingContext,
    attributes: Attributes
  ): number {
    let baseRate = 0.9; // High sampling for performance analysis

    const duration = Number(attributes['operation.duration_ms']) || 0;

    // Higher sampling for slower operations
    if (duration > 5000) {
      baseRate = 1.0; // Always sample very slow operations
    } else if (duration > 2000) {
      baseRate = 0.95;
    } else if (duration > 1000) {
      baseRate = 0.9;
    }

    // Increase sampling for resource-intensive operations
    if (samplingContext.resourceIntensive) {
      baseRate = Math.min(baseRate * 1.2, 1.0);
    }

    return baseRate;
  }

  /**
   * Calculate business critical operation sampling
   */
  private calculateBusinessCriticalSampling(samplingContext: SamplingContext): number {
    if (!samplingContext.businessProcess) {
      return 0.5; // Default rate
    }

    const config = this.businessProcessConfigs.get(samplingContext.businessProcess);
    if (!config) {
      return 0.5;
    }

    let rate = config.baseRate;

    // Apply priority multipliers
    switch (samplingContext.priority) {
      case 'critical':
        rate = 1.0;
        break;
      case 'high':
        rate = Math.min(rate * 1.5, 1.0);
        break;
      case 'medium':
        rate = rate;
        break;
      case 'low':
        rate = rate * 0.7;
        break;
    }

    return Math.max(Math.min(rate, config.maxSampleRate), config.minSampleRate);
  }

  /**
   * Calculate tenant-based sampling rate
   */
  private calculateTenantBasedSampling(tenantId: string): number {
    const tenantConfig = this.tenantConfigs.get(tenantId);
    if (!tenantConfig) {
      // Create default config for new tenant
      return this.createDefaultTenantConfig(tenantId).baseRate;
    }

    // Check budget limits
    if (tenantConfig.currentUsage >= tenantConfig.budgetLimit) {
      // Exceeded budget - reduce sampling
      return Math.max(tenantConfig.baseRate * 0.1, 0.01);
    }

    // Apply tier-based multipliers
    let rate = tenantConfig.baseRate;
    switch (tenantConfig.tier) {
      case 'enterprise':
        rate *= 1.5;
        break;
      case 'premium':
        rate *= 1.2;
        break;
      case 'basic':
        rate *= 1.0;
        break;
      case 'free':
        rate *= 0.5;
        break;
    }

    return Math.min(rate, 1.0);
  }

  /**
   * Calculate adaptive sampling based on historical data
   */
  private calculateAdaptiveSampling(samplingContext: SamplingContext, traceId: string): number {
    const history = this.samplingHistory.get(traceId.substring(0, 8)) || [];
    
    if (history.length < 10) {
      return 0.1; // Default rate for new traces
    }

    // Calculate recent sampling efficiency
    const recentSamples = history.slice(-20);
    const avgUtility = recentSamples.reduce((sum, utility) => sum + utility, 0) / recentSamples.length;

    // Adjust sampling rate based on utility
    let rate = 0.1; // Base rate
    
    if (avgUtility > 0.8) {
      rate = 0.3; // High utility - increase sampling
    } else if (avgUtility > 0.6) {
      rate = 0.2;
    } else if (avgUtility < 0.2) {
      rate = 0.05; // Low utility - decrease sampling
    }

    return rate;
  }

  /**
   * Calculate cost-optimized sampling
   */
  private calculateCostOptimizedSampling(samplingContext: SamplingContext): number {
    let baseRate = 0.05; // Very conservative base rate

    // Increase for important contexts
    if (samplingContext.revenueImpact) {
      baseRate *= 4; // 0.2
    }
    
    if (samplingContext.securitySensitive) {
      baseRate *= 3; // 0.15
    }

    if (samplingContext.priority === 'high') {
      baseRate *= 2; // 0.1
    }

    return Math.min(baseRate, 0.25); // Cap at 25%
  }

  /**
   * Apply system load adjustments to sampling rate
   */
  private applySystemLoadAdjustments(baseRate: number): number {
    const { cpuUsage, memoryUsage, spanQueueSize, exportLatency } = this.systemMetrics;

    let adjustmentFactor = 1.0;

    // Reduce sampling under high CPU load
    if (cpuUsage > 80) {
      adjustmentFactor *= 0.5;
    } else if (cpuUsage > 60) {
      adjustmentFactor *= 0.8;
    }

    // Reduce sampling under high memory usage
    if (memoryUsage > 85) {
      adjustmentFactor *= 0.3;
    } else if (memoryUsage > 70) {
      adjustmentFactor *= 0.7;
    }

    // Reduce sampling if export queue is backing up
    if (spanQueueSize > 10000) {
      adjustmentFactor *= 0.2;
    } else if (spanQueueSize > 5000) {
      adjustmentFactor *= 0.6;
    }

    // Reduce sampling if export latency is high
    if (exportLatency > 5000) {
      adjustmentFactor *= 0.4;
    } else if (exportLatency > 2000) {
      adjustmentFactor *= 0.8;
    }

    return Math.max(baseRate * adjustmentFactor, 0.001); // Minimum 0.1% sampling
  }

  /**
   * Check if adaptive sampling should be used
   */
  private shouldUseAdaptiveSampling(): boolean {
    return this.systemMetrics.cpuUsage > 50 || 
           this.systemMetrics.memoryUsage > 60 ||
           this.systemMetrics.spanQueueSize > 1000;
  }

  /**
   * Update sampling history for learning
   */
  private updateSamplingHistory(traceId: string, utility: number): void {
    const key = traceId.substring(0, 8);
    const history = this.samplingHistory.get(key) || [];
    
    history.push(utility);
    
    // Keep only recent history
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
    
    this.samplingHistory.set(key, history);
  }

  /**
   * Log sampling decision for analysis
   */
  private logSamplingDecision(
    decision: SamplingResult,
    strategy: SamplingStrategy,
    samplingContext: SamplingContext,
    spanName: string
  ): void {
    logger.debug('Intelligent sampling decision made', {
      event: 'sampling.decision',
      decision: decision.decision === SamplingDecision.RECORD_AND_SAMPLED ? 'sampled' : 'not_sampled',
      strategy,
      sampling_rate: decision.attributes!['sampling.rate'],
      sampling_reason: decision.attributes!['sampling.reason'],
      span_name: spanName,
      business_process: samplingContext.businessProcess,
      tenant_id: samplingContext.tenantId,
      priority: samplingContext.priority,
      system_cpu: this.systemMetrics.cpuUsage,
      system_memory: this.systemMetrics.memoryUsage
    });
  }

  /**
   * Initialize default configurations
   */
  private initializeDefaultConfigs(): void {
    // Authentication flow - always sample for security
    this.businessProcessConfigs.set(BusinessProcess.AUTHENTICATION_FLOW, {
      process: BusinessProcess.AUTHENTICATION_FLOW,
      strategy: SamplingStrategy.ALWAYS,
      baseRate: 1.0,
      errorMultiplier: 1.0,
      performanceThreshold: 500,
      performanceMultiplier: 1.0,
      maxSampleRate: 1.0,
      minSampleRate: 1.0
    });

    // User onboarding - high sampling for UX
    this.businessProcessConfigs.set(BusinessProcess.USER_ONBOARDING, {
      process: BusinessProcess.USER_ONBOARDING,
      strategy: SamplingStrategy.BUSINESS_CRITICAL,
      baseRate: 0.8,
      errorMultiplier: 1.0,
      performanceThreshold: 1000,
      performanceMultiplier: 1.2,
      maxSampleRate: 1.0,
      minSampleRate: 0.5
    });

    // Metrics ingestion - adaptive sampling
    this.businessProcessConfigs.set(BusinessProcess.METRICS_INGESTION, {
      process: BusinessProcess.METRICS_INGESTION,
      strategy: SamplingStrategy.ADAPTIVE,
      baseRate: 0.1,
      errorMultiplier: 2.0,
      performanceThreshold: 200,
      performanceMultiplier: 1.5,
      maxSampleRate: 0.5,
      minSampleRate: 0.01
    });

    // Data processing - cost optimized
    this.businessProcessConfigs.set(BusinessProcess.DATA_PROCESSING, {
      process: BusinessProcess.DATA_PROCESSING,
      strategy: SamplingStrategy.COST_OPTIMIZED,
      baseRate: 0.05,
      errorMultiplier: 3.0,
      performanceThreshold: 5000,
      performanceMultiplier: 2.0,
      maxSampleRate: 0.2,
      minSampleRate: 0.001
    });
  }

  /**
   * Initialize system metrics monitoring
   */
  private initializeSystemMetrics(): SystemMetrics {
    return {
      cpuUsage: 0,
      memoryUsage: 0,
      spanQueueSize: 0,
      exportLatency: 0,
      errorRate: 0,
      requestRate: 0,
      lastUpdated: new Date()
    };
  }

  /**
   * Start system monitoring for adaptive sampling
   */
  private startSystemMonitoring(): void {
    setInterval(() => {
      this.updateSystemMetrics();
    }, 30000); // Update every 30 seconds
  }

  /**
   * Start configuration refresh
   */
  private startConfigRefresh(): void {
    setInterval(() => {
      this.refreshConfigurations();
    }, 300000); // Refresh every 5 minutes
  }

  /**
   * Update system metrics
   */
  private updateSystemMetrics(): void {
    // In a real implementation, these would come from system monitoring
    this.systemMetrics = {
      cpuUsage: process.cpuUsage().user / 1000000, // Convert to percentage
      memoryUsage: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100,
      spanQueueSize: 0, // Would come from OTEL exporter queue
      exportLatency: 0, // Would come from OTEL exporter metrics
      errorRate: 0, // Would come from error tracking
      requestRate: 0, // Would come from request metrics
      lastUpdated: new Date()
    };
  }

  /**
   * Create default tenant configuration
   */
  private createDefaultTenantConfig(tenantId: string): TenantSamplingConfig {
    const config: TenantSamplingConfig = {
      tenantId,
      tier: 'basic', // Default tier
      baseRate: 0.1,
      priorityMultiplier: 1.0,
      budgetLimit: 10000, // 10k spans per hour
      currentUsage: 0,
      resetTime: new Date(Date.now() + 3600000) // Reset in 1 hour
    };

    this.tenantConfigs.set(tenantId, config);
    return config;
  }

  /**
   * Refresh configurations from external sources
   */
  private refreshConfigurations(): void {
    // In a real implementation, this would fetch updated configs from database or config service
    this.lastConfigUpdate = new Date();
    
    logger.info('Intelligent sampling configurations refreshed', {
      event: 'sampling.config.refreshed',
      business_processes: this.businessProcessConfigs.size,
      tenants: this.tenantConfigs.size,
      last_update: this.lastConfigUpdate
    });
  }

  /**
   * Get current sampling statistics
   */
  public getSamplingStats(): any {
    return {
      system_metrics: this.systemMetrics,
      business_process_configs: Array.from(this.businessProcessConfigs.values()),
      tenant_configs: Array.from(this.tenantConfigs.values()).length,
      sampling_history_size: this.samplingHistory.size,
      last_config_update: this.lastConfigUpdate
    };
  }

  /**
   * Update tenant configuration
   */
  public updateTenantConfig(tenantId: string, updates: Partial<TenantSamplingConfig>): void {
    const existing = this.tenantConfigs.get(tenantId) || this.createDefaultTenantConfig(tenantId);
    this.tenantConfigs.set(tenantId, { ...existing, ...updates });
  }

  /**
   * Update business process configuration
   */
  public updateBusinessProcessConfig(
    process: BusinessProcess, 
    updates: Partial<BusinessProcessSamplingConfig>
  ): void {
    const existing = this.businessProcessConfigs.get(process);
    if (existing) {
      this.businessProcessConfigs.set(process, { ...existing, ...updates });
    }
  }

  toString(): string {
    return 'IntelligentSamplingService';
  }
}

// Export singleton instance
export const intelligentSamplingService = new IntelligentSamplingService();