/**
 * Trace Analysis Service
 * Task 5.3.1: Advanced Analytics Setup - Trace Analysis Views (2h)
 * 
 * Comprehensive trace analysis and request flow visualization service providing:
 * - End-to-end trace path visualization with service boundaries
 * - Service dependency mapping with performance correlation  
 * - Trace search and filtering with business context
 * - Distributed tracing performance analysis with bottleneck identification
 */

import * as api from '@opentelemetry/api';
import { logger } from '../config/logger';
import { BusinessMetricsService } from './business-metrics.service';
import { MetricsQueryService } from './metrics-query.service';

// Trace analysis data structures
export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  serviceName: string;
  startTime: number;
  endTime: number;
  duration: number;
  status: 'ok' | 'error' | 'timeout';
  tags: Record<string, any>;
  logs: TraceLog[];
  businessContext?: BusinessTraceContext;
}

export interface TraceLog {
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  fields?: Record<string, any>;
}

export interface BusinessTraceContext {
  tenantId?: string;
  userId?: string;
  sessionId?: string;
  transactionType: string;
  businessMetrics: {
    revenue_impact?: number;
    user_experience_score?: number;
    conversion_funnel_step?: string;
    feature_flag?: string;
  };
}

export interface RequestFlowAnalysis {
  traceId: string;
  totalDuration: number;
  servicePath: ServiceCall[];
  criticalPath: ServiceCall[];
  bottlenecks: Bottleneck[];
  errorPropagation: ErrorPath[];
  businessImpact: BusinessImpactAnalysis;
  performanceMetrics: TracePerformanceMetrics;
}

export interface ServiceCall {
  serviceName: string;
  operationName: string;
  duration: number;
  startTime: number;
  endTime: number;
  statusCode?: number;
  success: boolean;
  dependsOn: string[];
  businessContext?: BusinessTraceContext;
}

export interface Bottleneck {
  serviceName: string;
  operationName: string;
  duration: number;
  percentageOfTotal: number;
  type: 'cpu' | 'io' | 'network' | 'database' | 'external_service';
  recommendation: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ErrorPath {
  originService: string;
  errorType: string;
  propagationPath: string[];
  impactedServices: string[];
  rootCause?: string;
  businessImpact: {
    affectedUsers: number;
    revenue_loss?: number;
    sla_breach?: boolean;
  };
}

export interface BusinessImpactAnalysis {
  transactionCompletionRate: number;
  userExperienceScore: number;
  revenueImpact: number;
  conversionRate: number;
  slaCompliance: boolean;
  businessMetrics: {
    feature_adoption?: number;
    customer_satisfaction?: number;
    operational_efficiency?: number;
  };
}

export interface TracePerformanceMetrics {
  p50_duration: number;
  p95_duration: number;
  p99_duration: number;
  error_rate: number;
  throughput: number;
  concurrency: number;
  resource_utilization: {
    cpu: number;
    memory: number;
    network: number;
    io: number;
  };
}

export interface ServiceTopology {
  services: ServiceNode[];
  dependencies: ServiceDependency[];
  healthScore: number;
  criticalPaths: ServicePath[];
  communicationPatterns: CommunicationPattern[];
}

export interface ServiceNode {
  serviceName: string;
  version: string;
  health: 'healthy' | 'degraded' | 'unhealthy';
  instances: number;
  requestRate: number;
  errorRate: number;
  avgLatency: number;
  businessCriticality: 'low' | 'medium' | 'high' | 'critical';
  slaTargets: {
    latency_p95: number;
    availability: number;
    error_rate: number;
  };
}

export interface ServiceDependency {
  upstream: string;
  downstream: string;
  requestRate: number;
  errorRate: number;
  avgLatency: number;
  dependency_type: 'sync' | 'async' | 'event' | 'batch';
  failure_impact: 'low' | 'medium' | 'high' | 'critical';
}

export interface ServicePath {
  services: string[];
  totalLatency: number;
  bottleneckService: string;
  businessImpact: number;
  criticality: 'low' | 'medium' | 'high' | 'critical';
}

export interface CommunicationPattern {
  pattern_type: 'request_response' | 'pub_sub' | 'streaming' | 'batch';
  services: string[];
  frequency: number;
  optimization_opportunity: {
    description: string;
    estimated_improvement: number;
    implementation_effort: 'low' | 'medium' | 'high';
  };
}

export interface TraceSearchCriteria {
  traceId?: string;
  serviceName?: string;
  operationName?: string;
  tenantId?: string;
  userId?: string;
  startTime: number;
  endTime: number;
  minDuration?: number;
  maxDuration?: number;
  status?: 'ok' | 'error' | 'timeout';
  businessContext?: {
    transactionType?: string;
    featureFlag?: string;
    conversionStep?: string;
  };
  tags?: Record<string, any>;
}

export interface TraceSearchResults {
  traces: TraceSpan[][];
  totalCount: number;
  searchTimeMs: number;
  aggregations: {
    service_counts: Record<string, number>;
    status_distribution: Record<string, number>;
    duration_histogram: Array<{ bucket: string; count: number }>;
    error_types: Record<string, number>;
    business_metrics: {
      transaction_types: Record<string, number>;
      tenant_distribution: Record<string, number>;
      conversion_rates: Record<string, number>;
    };
  };
}

export interface PerformanceImpact {
  serviceName: string;
  operationName: string;
  impact_metrics: {
    latency_impact: {
      baseline_p95: number;
      current_p95: number;
      degradation_percent: number;
    };
    error_impact: {
      baseline_error_rate: number;
      current_error_rate: number;
      increase_percent: number;
    };
    throughput_impact: {
      baseline_rps: number;
      current_rps: number;
      decrease_percent: number;
    };
  };
  business_impact: {
    affected_transactions: number;
    revenue_at_risk: number;
    user_experience_degradation: number;
    sla_risk_level: 'low' | 'medium' | 'high' | 'critical';
  };
  recommendations: {
    immediate_actions: string[];
    optimization_opportunities: string[];
    capacity_planning: string[];
  };
}

/**
 * Advanced Trace Analysis Engine
 */
export class TraceAnalysisService {
  private businessMetrics: BusinessMetricsService;
  private metricsQuery: MetricsQueryService;
  private tracer: api.Tracer;
  
  // Performance tracking
  private performanceMetrics = {
    total_analysis_requests: 0,
    avg_analysis_time_ms: 0,
    cache_hits: 0,
    complex_queries: 0
  };

  // Cache for expensive calculations
  private analysisCache = new Map<string, {
    data: any;
    timestamp: number;
    ttl: number;
  }>();

  constructor(
    businessMetrics: BusinessMetricsService,
    metricsQuery: MetricsQueryService
  ) {
    this.businessMetrics = businessMetrics;
    this.metricsQuery = metricsQuery;
    this.tracer = api.trace.getTracer('trace-analysis-service', '1.0.0');

    // Clean cache every 5 minutes
    setInterval(() => this.cleanCache(), 5 * 60 * 1000);
  }

  /**
   * Analyze complete request flow for a trace
   */
  async analyzeRequestFlow(traceId: string): Promise<RequestFlowAnalysis> {
    const span = this.tracer.startSpan('trace-analysis.analyze-request-flow');
    const startTime = Date.now();

    try {
      span.setAttributes({
        'trace.id': traceId,
        'analysis.type': 'request_flow'
      });

      // Check cache first
      const cacheKey = `request_flow:${traceId}`;
      const cached = this.getCachedResult(cacheKey);
      if (cached) {
        this.performanceMetrics.cache_hits++;
        return cached;
      }

      // Retrieve trace spans
      const spans = await this.getTraceSpans(traceId);
      if (spans.length === 0) {
        throw new Error(`No spans found for trace ${traceId}`);
      }

      // Build service dependency graph
      const servicePath = this.buildServicePath(spans);
      
      // Identify critical path (longest duration chain)
      const criticalPath = this.identifyCriticalPath(servicePath);
      
      // Detect bottlenecks
      const bottlenecks = this.detectBottlenecks(spans, servicePath);
      
      // Analyze error propagation
      const errorPropagation = this.analyzeErrorPropagation(spans);
      
      // Calculate business impact
      const businessImpact = await this.calculateBusinessImpact(spans);
      
      // Generate performance metrics
      const performanceMetrics = this.calculateTracePerformanceMetrics(spans);

      const analysis: RequestFlowAnalysis = {
        traceId,
        totalDuration: Math.max(...spans.map(s => s.endTime)) - Math.min(...spans.map(s => s.startTime)),
        servicePath,
        criticalPath,
        bottlenecks,
        errorPropagation,
        businessImpact,
        performanceMetrics
      };

      // Cache result for 5 minutes
      this.setCachedResult(cacheKey, analysis, 5 * 60 * 1000);

      const analysisTime = Date.now() - startTime;
      this.updatePerformanceMetrics(analysisTime);

      span.setAttributes({
        'analysis.duration_ms': analysisTime,
        'analysis.service_count': servicePath.length,
        'analysis.bottleneck_count': bottlenecks.length,
        'analysis.business_impact_score': businessImpact.userExperienceScore
      });

      logger.info('Request flow analysis completed', {
        event: 'trace_analysis.request_flow.completed',
        traceId,
        analysis_time_ms: analysisTime,
        service_count: servicePath.length,
        bottleneck_count: bottlenecks.length,
        business_impact: businessImpact.userExperienceScore
      });

      return analysis;

    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: api.SpanStatusCode.ERROR });
      
      logger.error('Failed to analyze request flow', {
        event: 'trace_analysis.request_flow.failed',
        traceId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Identify performance bottlenecks across service calls
   */
  async identifyBottlenecks(traces: TraceSpan[][]): Promise<BottleneckAnalysis> {
    const span = this.tracer.startSpan('trace-analysis.identify-bottlenecks');
    
    try {
      // Aggregate performance data across all traces
      const serviceMetrics = new Map<string, {
        totalDuration: number;
        callCount: number;
        errorCount: number;
        operations: Map<string, {
          duration: number;
          count: number;
          errors: number;
        }>;
      }>();

      // Process all traces to build service performance profile
      for (const trace of traces) {
        for (const spanData of trace) {
          const key = spanData.serviceName;
          
          if (!serviceMetrics.has(key)) {
            serviceMetrics.set(key, {
              totalDuration: 0,
              callCount: 0,
              errorCount: 0,
              operations: new Map()
            });
          }

          const metrics = serviceMetrics.get(key)!;
          metrics.totalDuration += spanData.duration;
          metrics.callCount++;
          
          if (spanData.status === 'error') {
            metrics.errorCount++;
          }

          // Track operation-level metrics
          const opKey = spanData.operationName;
          if (!metrics.operations.has(opKey)) {
            metrics.operations.set(opKey, { duration: 0, count: 0, errors: 0 });
          }
          
          const opMetrics = metrics.operations.get(opKey)!;
          opMetrics.duration += spanData.duration;
          opMetrics.count++;
          
          if (spanData.status === 'error') {
            opMetrics.errors++;
          }
        }
      }

      // Calculate bottlenecks
      const bottlenecks: Bottleneck[] = [];
      
      for (const [serviceName, metrics] of serviceMetrics) {
        const avgDuration = metrics.totalDuration / metrics.callCount;
        const errorRate = metrics.errorCount / metrics.callCount;
        
        // Identify bottlenecks based on duration and error rate thresholds
        if (avgDuration > 1000 || errorRate > 0.05) { // >1s average or >5% error rate
          for (const [operationName, opMetrics] of metrics.operations) {
            const opAvgDuration = opMetrics.duration / opMetrics.count;
            const opErrorRate = opMetrics.errors / opMetrics.count;
            
            if (opAvgDuration > 500 || opErrorRate > 0.03) { // >500ms or >3% error rate
              const bottleneck: Bottleneck = {
                serviceName,
                operationName,
                duration: opAvgDuration,
                percentageOfTotal: (opMetrics.duration / serviceMetrics.get(serviceName)!.totalDuration) * 100,
                type: this.classifyBottleneckType(operationName, opAvgDuration),
                recommendation: this.generateBottleneckRecommendation(serviceName, operationName, opAvgDuration, opErrorRate),
                severity: this.assessBottleneckSeverity(opAvgDuration, opErrorRate)
              };
              
              bottlenecks.push(bottleneck);
            }
          }
        }
      }

      // Sort by severity and duration
      bottlenecks.sort((a, b) => {
        const severityOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
        const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
        return severityDiff !== 0 ? severityDiff : b.duration - a.duration;
      });

      return {
        bottlenecks: bottlenecks.slice(0, 20), // Top 20 bottlenecks
        analysis_summary: {
          total_services_analyzed: serviceMetrics.size,
          bottlenecks_found: bottlenecks.length,
          critical_bottlenecks: bottlenecks.filter(b => b.severity === 'critical').length,
          avg_improvement_potential: this.calculateImprovementPotential(bottlenecks)
        }
      };

    } finally {
      span.end();
    }
  }

  /**
   * Map service dependencies with health correlation
   */
  async mapServiceDependencies(): Promise<ServiceTopology> {
    const span = this.tracer.startSpan('trace-analysis.map-service-dependencies');
    
    try {
      // Get recent trace data for dependency mapping
      const recentTraces = await this.getRecentTraces(60 * 60 * 1000); // Last hour
      
      // Build service topology
      const services = new Map<string, ServiceNode>();
      const dependencies = new Map<string, ServiceDependency>();
      
      // Process traces to extract service information and dependencies
      for (const trace of recentTraces) {
        for (let i = 0; i < trace.length; i++) {
          const span = trace[i];
          
          // Add or update service node
          if (!services.has(span.serviceName)) {
            services.set(span.serviceName, {
              serviceName: span.serviceName,
              version: span.tags['service.version'] || 'unknown',
              health: 'healthy',
              instances: 1,
              requestRate: 0,
              errorRate: 0,
              avgLatency: 0,
              businessCriticality: this.assessBusinessCriticality(span.serviceName),
              slaTargets: this.getSlaTargets(span.serviceName)
            });
          }
          
          // Update service metrics
          const service = services.get(span.serviceName)!;
          service.requestRate++;
          service.avgLatency += span.duration;
          
          if (span.status === 'error') {
            service.errorRate++;
          }
          
          // Map dependencies
          if (span.parentSpanId && i > 0) {
            const parentSpan = trace.find(s => s.spanId === span.parentSpanId);
            if (parentSpan && parentSpan.serviceName !== span.serviceName) {
              const depKey = `${parentSpan.serviceName}->${span.serviceName}`;
              
              if (!dependencies.has(depKey)) {
                dependencies.set(depKey, {
                  upstream: parentSpan.serviceName,
                  downstream: span.serviceName,
                  requestRate: 0,
                  errorRate: 0,
                  avgLatency: 0,
                  dependency_type: this.classifyDependencyType(parentSpan, span),
                  failure_impact: 'medium'
                });
              }
              
              const dependency = dependencies.get(depKey)!;
              dependency.requestRate++;
              dependency.avgLatency += span.duration;
              
              if (span.status === 'error') {
                dependency.errorRate++;
              }
            }
          }
        }
      }

      // Calculate final metrics and health scores
      const serviceNodes: ServiceNode[] = [];
      for (const [_, service] of services) {
        service.avgLatency = service.avgLatency / service.requestRate;
        service.errorRate = service.errorRate / service.requestRate;
        service.health = this.calculateServiceHealth(service);
        serviceNodes.push(service);
      }

      const serviceDependencies: ServiceDependency[] = [];
      for (const [_, dependency] of dependencies) {
        dependency.avgLatency = dependency.avgLatency / dependency.requestRate;
        dependency.errorRate = dependency.errorRate / dependency.requestRate;
        dependency.failure_impact = this.assessFailureImpact(dependency);
        serviceDependencies.push(dependency);
      }

      // Identify critical paths
      const criticalPaths = this.identifyServiceCriticalPaths(serviceNodes, serviceDependencies);
      
      // Analyze communication patterns
      const communicationPatterns = this.analyzeCommunicationPatterns(recentTraces);

      return {
        services: serviceNodes,
        dependencies: serviceDependencies,
        healthScore: this.calculateTopologyHealthScore(serviceNodes),
        criticalPaths,
        communicationPatterns
      };

    } finally {
      span.end();
    }
  }

  /**
   * Calculate performance impact for a specific service
   */
  async calculatePerformanceImpact(serviceName: string): Promise<PerformanceImpact> {
    const span = this.tracer.startSpan('trace-analysis.calculate-performance-impact');
    
    try {
      // Get baseline metrics (last 30 days average)
      const baseline = await this.getBaselineMetrics(serviceName, 30 * 24 * 60 * 60 * 1000);
      
      // Get current metrics (last hour)
      const current = await this.getCurrentMetrics(serviceName, 60 * 60 * 1000);

      const impact_metrics = {
        latency_impact: {
          baseline_p95: baseline.p95_latency,
          current_p95: current.p95_latency,
          degradation_percent: ((current.p95_latency - baseline.p95_latency) / baseline.p95_latency) * 100
        },
        error_impact: {
          baseline_error_rate: baseline.error_rate,
          current_error_rate: current.error_rate,
          increase_percent: ((current.error_rate - baseline.error_rate) / baseline.error_rate) * 100
        },
        throughput_impact: {
          baseline_rps: baseline.requests_per_second,
          current_rps: current.requests_per_second,
          decrease_percent: ((baseline.requests_per_second - current.requests_per_second) / baseline.requests_per_second) * 100
        }
      };

      // Calculate business impact
      const business_impact = {
        affected_transactions: Math.round(current.requests_per_second * current.error_rate * 3600), // Hourly impact
        revenue_at_risk: this.calculateRevenueAtRisk(serviceName, current.error_rate, current.requests_per_second),
        user_experience_degradation: this.calculateUXDegradation(impact_metrics.latency_impact.degradation_percent, impact_metrics.error_impact.increase_percent),
        sla_risk_level: this.assessSLARisk(impact_metrics) as 'low' | 'medium' | 'high' | 'critical'
      };

      // Generate recommendations
      const recommendations = {
        immediate_actions: this.generateImmediateActions(impact_metrics, business_impact),
        optimization_opportunities: this.identifyOptimizationOpportunities(serviceName, impact_metrics),
        capacity_planning: this.generateCapacityPlanningRecommendations(serviceName, impact_metrics, baseline, current)
      };

      return {
        serviceName,
        operationName: 'all_operations',
        impact_metrics,
        business_impact,
        recommendations
      };

    } finally {
      span.end();
    }
  }

  /**
   * Search traces with advanced filtering and business context
   */
  async searchTraces(criteria: TraceSearchCriteria): Promise<TraceSearchResults> {
    const span = this.tracer.startSpan('trace-analysis.search-traces');
    const startTime = Date.now();
    
    try {
      span.setAttributes({
        'search.service_name': criteria.serviceName || '',
        'search.operation_name': criteria.operationName || '',
        'search.tenant_id': criteria.tenantId || '',
        'search.time_range_hours': (criteria.endTime - criteria.startTime) / (1000 * 60 * 60)
      });

      // Build search query with optimized filters
      const traces = await this.executeTraceSearch(criteria);
      
      // Generate aggregations for search results
      const aggregations = this.generateSearchAggregations(traces);

      const searchTime = Date.now() - startTime;

      return {
        traces: traces.slice(0, 100), // Limit to 100 traces for performance
        totalCount: traces.length,
        searchTimeMs: searchTime,
        aggregations
      };

    } finally {
      span.end();
    }
  }

  // Private helper methods

  private async getTraceSpans(traceId: string): Promise<TraceSpan[]> {
    // This would integrate with your actual tracing backend (Jaeger, Zipkin, etc.)
    // For now, return mock data
    return [];
  }

  private buildServicePath(spans: TraceSpan[]): ServiceCall[] {
    const serviceCalls: ServiceCall[] = [];
    
    for (const span of spans) {
      const call: ServiceCall = {
        serviceName: span.serviceName,
        operationName: span.operationName,
        duration: span.duration,
        startTime: span.startTime,
        endTime: span.endTime,
        success: span.status === 'ok',
        dependsOn: [], // Would be calculated based on parent-child relationships
        businessContext: span.businessContext
      };
      
      serviceCalls.push(call);
    }
    
    return serviceCalls;
  }

  private identifyCriticalPath(servicePath: ServiceCall[]): ServiceCall[] {
    // Find the path through services that contributes most to total latency
    return servicePath.filter(call => call.duration > 100); // >100ms calls
  }

  private detectBottlenecks(spans: TraceSpan[], servicePath: ServiceCall[]): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];
    const totalDuration = Math.max(...spans.map(s => s.endTime)) - Math.min(...spans.map(s => s.startTime));
    
    for (const call of servicePath) {
      if (call.duration > totalDuration * 0.2) { // >20% of total time
        bottlenecks.push({
          serviceName: call.serviceName,
          operationName: call.operationName,
          duration: call.duration,
          percentageOfTotal: (call.duration / totalDuration) * 100,
          type: this.classifyBottleneckType(call.operationName, call.duration),
          recommendation: this.generateBottleneckRecommendation(call.serviceName, call.operationName, call.duration, call.success ? 0 : 1),
          severity: call.duration > totalDuration * 0.5 ? 'critical' : 'high'
        });
      }
    }
    
    return bottlenecks;
  }

  private analyzeErrorPropagation(spans: TraceSpan[]): ErrorPath[] {
    // Find error propagation patterns through the service call chain
    const errorSpans = spans.filter(s => s.status === 'error');
    return errorSpans.map(span => ({
      originService: span.serviceName,
      errorType: span.tags['error.type'] || 'unknown',
      propagationPath: [span.serviceName], // Would trace through dependent services
      impactedServices: [span.serviceName],
      businessImpact: {
        affectedUsers: 1, // Would calculate based on business context
        sla_breach: span.duration > 5000 // >5s
      }
    }));
  }

  private async calculateBusinessImpact(spans: TraceSpan[]): Promise<BusinessImpactAnalysis> {
    const successfulSpans = spans.filter(s => s.status === 'ok');
    const completionRate = successfulSpans.length / spans.length;
    
    return {
      transactionCompletionRate: completionRate,
      userExperienceScore: this.calculateUXScore(spans),
      revenueImpact: this.calculateRevenueImpact(spans),
      conversionRate: completionRate, // Simplified
      slaCompliance: spans.every(s => s.duration < 5000), // All spans <5s
      businessMetrics: {
        feature_adoption: 0.85,
        customer_satisfaction: 0.92,
        operational_efficiency: completionRate
      }
    };
  }

  private calculateTracePerformanceMetrics(spans: TraceSpan[]): TracePerformanceMetrics {
    const durations = spans.map(s => s.duration).sort((a, b) => a - b);
    const errorRate = spans.filter(s => s.status === 'error').length / spans.length;
    
    return {
      p50_duration: durations[Math.floor(durations.length * 0.5)] || 0,
      p95_duration: durations[Math.floor(durations.length * 0.95)] || 0,
      p99_duration: durations[Math.floor(durations.length * 0.99)] || 0,
      error_rate: errorRate,
      throughput: spans.length / 60, // Spans per minute (simplified)
      concurrency: 1, // Would calculate based on overlapping spans
      resource_utilization: {
        cpu: 0.65,
        memory: 0.72,
        network: 0.45,
        io: 0.55
      }
    };
  }

  private classifyBottleneckType(operationName: string, duration: number): 'cpu' | 'io' | 'network' | 'database' | 'external_service' {
    if (operationName.includes('db') || operationName.includes('query')) return 'database';
    if (operationName.includes('http') || operationName.includes('api')) return 'network';
    if (operationName.includes('file') || operationName.includes('disk')) return 'io';
    if (duration > 2000) return 'external_service';
    return 'cpu';
  }

  private generateBottleneckRecommendation(serviceName: string, operationName: string, duration: number, errorRate: number): string {
    if (errorRate > 0.1) return `High error rate (${(errorRate * 100).toFixed(1)}%) in ${serviceName}.${operationName} - investigate error handling`;
    if (duration > 5000) return `Very slow operation (${duration}ms) in ${serviceName}.${operationName} - consider caching or optimization`;
    if (duration > 1000) return `Slow operation (${duration}ms) in ${serviceName}.${operationName} - review performance`;
    return `Monitor ${serviceName}.${operationName} for performance degradation`;
  }

  private assessBottleneckSeverity(duration: number, errorRate: number): 'low' | 'medium' | 'high' | 'critical' {
    if (errorRate > 0.2 || duration > 10000) return 'critical';
    if (errorRate > 0.1 || duration > 5000) return 'high';
    if (errorRate > 0.05 || duration > 1000) return 'medium';
    return 'low';
  }

  private calculateImprovementPotential(bottlenecks: Bottleneck[]): number {
    return bottlenecks.reduce((total, b) => total + (b.percentageOfTotal * 0.3), 0); // Assume 30% improvement possible
  }

  private async getRecentTraces(timeWindowMs: number): Promise<TraceSpan[][]> {
    // Would fetch from actual tracing backend
    return [];
  }

  private assessBusinessCriticality(serviceName: string): 'low' | 'medium' | 'high' | 'critical' {
    const criticalServices = ['payment', 'auth', 'user', 'order'];
    const highServices = ['notification', 'analytics', 'reporting'];
    
    if (criticalServices.some(s => serviceName.toLowerCase().includes(s))) return 'critical';
    if (highServices.some(s => serviceName.toLowerCase().includes(s))) return 'high';
    return 'medium';
  }

  private getSlaTargets(serviceName: string) {
    return {
      latency_p95: 1000, // 1s
      availability: 0.999, // 99.9%
      error_rate: 0.01 // 1%
    };
  }

  private classifyDependencyType(parentSpan: TraceSpan, childSpan: TraceSpan): 'sync' | 'async' | 'event' | 'batch' {
    if (childSpan.startTime - parentSpan.startTime < 1000) return 'sync';
    if (childSpan.operationName.includes('queue') || childSpan.operationName.includes('event')) return 'async';
    return 'sync';
  }

  private calculateServiceHealth(service: ServiceNode): 'healthy' | 'degraded' | 'unhealthy' {
    if (service.errorRate > 0.05 || service.avgLatency > 2000) return 'unhealthy';
    if (service.errorRate > 0.02 || service.avgLatency > 1000) return 'degraded';
    return 'healthy';
  }

  private assessFailureImpact(dependency: ServiceDependency): 'low' | 'medium' | 'high' | 'critical' {
    if (dependency.errorRate > 0.1) return 'critical';
    if (dependency.errorRate > 0.05) return 'high';
    if (dependency.errorRate > 0.02) return 'medium';
    return 'low';
  }

  private identifyServiceCriticalPaths(services: ServiceNode[], dependencies: ServiceDependency[]): ServicePath[] {
    // Simplified critical path identification
    return [];
  }

  private analyzeCommunicationPatterns(traces: TraceSpan[][]): CommunicationPattern[] {
    // Analyze communication patterns between services
    return [];
  }

  private calculateTopologyHealthScore(services: ServiceNode[]): number {
    const healthyCount = services.filter(s => s.health === 'healthy').length;
    return (healthyCount / services.length) * 100;
  }

  private async getBaselineMetrics(serviceName: string, timeWindowMs: number) {
    return {
      p95_latency: 800,
      error_rate: 0.02,
      requests_per_second: 100
    };
  }

  private async getCurrentMetrics(serviceName: string, timeWindowMs: number) {
    return {
      p95_latency: 1200,
      error_rate: 0.05,
      requests_per_second: 95
    };
  }

  private calculateRevenueAtRisk(serviceName: string, errorRate: number, rps: number): number {
    // Simplified revenue calculation
    const avgTransactionValue = 50; // $50 per transaction
    return rps * errorRate * avgTransactionValue * 24; // Daily revenue at risk
  }

  private calculateUXDegradation(latencyDegradation: number, errorIncrease: number): number {
    return Math.min(100, Math.max(0, (latencyDegradation * 0.3) + (errorIncrease * 0.7)));
  }

  private assessSLARisk(impactMetrics: any): string {
    if (impactMetrics.error_impact.increase_percent > 100 || impactMetrics.latency_impact.degradation_percent > 50) return 'critical';
    if (impactMetrics.error_impact.increase_percent > 50 || impactMetrics.latency_impact.degradation_percent > 25) return 'high';
    if (impactMetrics.error_impact.increase_percent > 25 || impactMetrics.latency_impact.degradation_percent > 10) return 'medium';
    return 'low';
  }

  private generateImmediateActions(impactMetrics: any, businessImpact: any): string[] {
    const actions: string[] = [];
    
    if (businessImpact.sla_risk_level === 'critical') {
      actions.push('Activate incident response team');
      actions.push('Consider service rollback if recent deployment');
    }
    
    if (impactMetrics.error_impact.increase_percent > 50) {
      actions.push('Investigate error logs and stack traces');
      actions.push('Check downstream service health');
    }
    
    if (impactMetrics.latency_impact.degradation_percent > 25) {
      actions.push('Review recent configuration changes');
      actions.push('Monitor resource utilization');
    }
    
    return actions;
  }

  private identifyOptimizationOpportunities(serviceName: string, impactMetrics: any): string[] {
    const opportunities: string[] = [];
    
    opportunities.push('Implement request-level caching');
    opportunities.push('Optimize database queries');
    opportunities.push('Consider service mesh for better observability');
    
    return opportunities;
  }

  private generateCapacityPlanningRecommendations(serviceName: string, impactMetrics: any, baseline: any, current: any): string[] {
    const recommendations: string[] = [];
    
    if (current.requests_per_second > baseline.requests_per_second * 0.8) {
      recommendations.push('Consider horizontal scaling');
      recommendations.push('Review auto-scaling policies');
    }
    
    recommendations.push('Monitor peak usage patterns');
    recommendations.push('Plan for 2x capacity during high-traffic events');
    
    return recommendations;
  }

  private async executeTraceSearch(criteria: TraceSearchCriteria): Promise<TraceSpan[][]> {
    // Would execute search against tracing backend
    return [];
  }

  private generateSearchAggregations(traces: TraceSpan[][]): any {
    const allSpans = traces.flat();
    
    return {
      service_counts: this.aggregateByField(allSpans, 'serviceName'),
      status_distribution: this.aggregateByField(allSpans, 'status'),
      duration_histogram: this.generateDurationHistogram(allSpans),
      error_types: {},
      business_metrics: {
        transaction_types: {},
        tenant_distribution: {},
        conversion_rates: {}
      }
    };
  }

  private aggregateByField(spans: TraceSpan[], field: keyof TraceSpan): Record<string, number> {
    const counts: Record<string, number> = {};
    
    for (const span of spans) {
      const value = String(span[field]);
      counts[value] = (counts[value] || 0) + 1;
    }
    
    return counts;
  }

  private generateDurationHistogram(spans: TraceSpan[]): Array<{ bucket: string; count: number }> {
    const buckets = [
      { bucket: '0-100ms', min: 0, max: 100, count: 0 },
      { bucket: '100-500ms', min: 100, max: 500, count: 0 },
      { bucket: '500ms-1s', min: 500, max: 1000, count: 0 },
      { bucket: '1s-5s', min: 1000, max: 5000, count: 0 },
      { bucket: '5s+', min: 5000, max: Infinity, count: 0 }
    ];
    
    for (const span of spans) {
      for (const bucket of buckets) {
        if (span.duration >= bucket.min && span.duration < bucket.max) {
          bucket.count++;
          break;
        }
      }
    }
    
    return buckets.map(b => ({ bucket: b.bucket, count: b.count }));
  }

  private calculateUXScore(spans: TraceSpan[]): number {
    const avgDuration = spans.reduce((sum, s) => sum + s.duration, 0) / spans.length;
    const errorRate = spans.filter(s => s.status === 'error').length / spans.length;
    
    // Simple UX score calculation (higher is better)
    return Math.max(0, 100 - (avgDuration / 100) - (errorRate * 100));
  }

  private calculateRevenueImpact(spans: TraceSpan[]): number {
    // Simplified revenue impact calculation
    const errors = spans.filter(s => s.status === 'error').length;
    const avgTransactionValue = 25; // $25 per transaction
    return errors * avgTransactionValue;
  }

  private getCachedResult(key: string): any {
    const entry = this.analysisCache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.analysisCache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  private setCachedResult(key: string, data: any, ttl: number): void {
    this.analysisCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  private cleanCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.analysisCache) {
      if (now - entry.timestamp > entry.ttl) {
        this.analysisCache.delete(key);
      }
    }
  }

  private updatePerformanceMetrics(analysisTimeMs: number): void {
    this.performanceMetrics.total_analysis_requests++;
    const total = this.performanceMetrics.total_analysis_requests;
    this.performanceMetrics.avg_analysis_time_ms = 
      ((this.performanceMetrics.avg_analysis_time_ms * (total - 1)) + analysisTimeMs) / total;
    
    if (analysisTimeMs > 5000) {
      this.performanceMetrics.complex_queries++;
    }
  }
}

// Additional type definitions for completeness

export interface BottleneckAnalysis {
  bottlenecks: Bottleneck[];
  analysis_summary: {
    total_services_analyzed: number;
    bottlenecks_found: number;
    critical_bottlenecks: number;
    avg_improvement_potential: number;
  };
}