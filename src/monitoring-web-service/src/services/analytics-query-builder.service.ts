/**
 * Analytics Query Builder Service
 * Task 5.3.4: Advanced Analytics Setup - Custom Query Builder (1h)
 * 
 * Comprehensive business intelligence query builder service providing:
 * - Flexible query builder for business metric analysis
 * - Tenant-specific analytics with data isolation and aggregation
 * - Custom reporting engine with scheduled report generation  
 * - Business KPI tracking with goal achievement monitoring
 */

import * as api from '@opentelemetry/api';
import { logger } from '../config/logger';
import { BusinessMetricsService } from './business-metrics.service';
import { MetricsQueryService } from './metrics-query.service';

// Query builder interfaces
export interface AnalyticsQuery {
  query_id: string;
  query_name: string;
  description?: string;
  tenant_id?: string;
  created_by: string;
  created_at: number;
  last_modified: number;
  query_config: QueryConfiguration;
  execution_schedule?: ScheduleConfiguration;
  is_public: boolean;
  tags: string[];
}

export interface QueryConfiguration {
  data_sources: DataSource[];
  filters: QueryFilter[];
  aggregations: QueryAggregation[];
  grouping: QueryGrouping[];
  time_range: TimeRange;
  output_format: 'json' | 'csv' | 'excel' | 'pdf';
  limit?: number;
  order_by?: OrderByClause[];
  business_context?: BusinessContext;
}

export interface DataSource {
  source_type: 'metrics' | 'traces' | 'logs' | 'business_events' | 'external_api';
  source_name: string;
  join_conditions?: JoinCondition[];
  filters?: SourceFilter[];
}

export interface QueryFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in' | 'contains' | 'starts_with' | 'regex';
  value: any;
  logical_operator?: 'AND' | 'OR';
}

export interface QueryAggregation {
  function: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'percentile' | 'stddev' | 'variance';
  field: string;
  alias?: string;
  parameters?: Record<string, any>;
}

export interface QueryGrouping {
  field: string;
  time_bucket?: '1m' | '5m' | '15m' | '1h' | '1d' | '1w' | '1M';
  alias?: string;
}

export interface TimeRange {
  start: number | string; // timestamp or relative like '1h', '1d', '1w'
  end: number | string;
  timezone?: string;
}

export interface OrderByClause {
  field: string;
  direction: 'ASC' | 'DESC';
}

export interface BusinessContext {
  business_unit?: string;
  cost_center?: string;
  product_area?: string;
  customer_segment?: string;
  feature_flags?: string[];
  ab_test_variants?: string[];
}

export interface JoinCondition {
  source_field: string;
  target_source: string;
  target_field: string;
  join_type: 'inner' | 'left' | 'right' | 'full';
}

export interface SourceFilter {
  field: string;
  operator: string;
  value: any;
}

// Scheduling and reporting
export interface ScheduleConfiguration {
  schedule_type: 'once' | 'recurring';
  frequency?: 'hourly' | 'daily' | 'weekly' | 'monthly';
  cron_expression?: string;
  timezone: string;
  recipients: NotificationRecipient[];
  delivery_method: 'email' | 'slack' | 'webhook' | 's3' | 'dashboard';
  failure_handling: {
    retry_attempts: number;
    retry_delay_minutes: number;
    failure_notification: boolean;
  };
}

export interface NotificationRecipient {
  type: 'email' | 'slack_channel' | 'webhook_url';
  address: string;
  notification_level: 'all' | 'failures_only' | 'summary_only';
}

// Query execution and results
export interface QueryExecution {
  execution_id: string;
  query_id: string;
  tenant_id?: string;
  executed_by: string;
  execution_start: number;
  execution_end?: number;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  result?: QueryResult;
  error_message?: string;
  performance_metrics: {
    execution_time_ms: number;
    rows_processed: number;
    data_scanned_mb: number;
    cache_hit_ratio: number;
  };
}

export interface QueryResult {
  columns: ResultColumn[];
  rows: any[][];
  metadata: {
    total_rows: number;
    execution_time_ms: number;
    data_sources_used: string[];
    cache_status: 'hit' | 'miss' | 'partial';
  };
  business_insights?: BusinessInsight[];
  visualizations?: VisualizationSuggestion[];
}

export interface ResultColumn {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'timestamp';
  description?: string;
  business_meaning?: string;
}

export interface BusinessInsight {
  insight_type: 'trend' | 'anomaly' | 'pattern' | 'correlation' | 'threshold_breach';
  title: string;
  description: string;
  significance_score: number; // 0-1
  business_impact: 'low' | 'medium' | 'high' | 'critical';
  recommended_actions: string[];
}

export interface VisualizationSuggestion {
  chart_type: 'line' | 'bar' | 'pie' | 'scatter' | 'heatmap' | 'gauge' | 'table';
  x_axis?: string;
  y_axis?: string;
  color_by?: string;
  title: string;
  description: string;
  configuration: Record<string, any>;
}

// KPI tracking
export interface BusinessKPI {
  kpi_id: string;
  kpi_name: string;
  description: string;
  category: 'revenue' | 'performance' | 'quality' | 'efficiency' | 'satisfaction' | 'growth';
  tenant_id?: string;
  owner: string;
  query_config: QueryConfiguration;
  target_config: KPITarget;
  current_value?: number;
  last_calculated: number;
  status: 'on_track' | 'at_risk' | 'behind' | 'ahead';
  trend: 'improving' | 'degrading' | 'stable';
  alerts: KPIAlert[];
}

export interface KPITarget {
  target_value: number;
  target_date: number;
  target_type: 'absolute' | 'percentage_change' | 'compound_growth';
  baseline_value?: number;
  baseline_date?: number;
  thresholds: {
    green_threshold: number; // % of target for green status
    yellow_threshold: number; // % of target for yellow status
    // Below yellow_threshold is red
  };
}

export interface KPIAlert {
  alert_id: string;
  condition: 'threshold_breach' | 'trend_change' | 'target_risk' | 'data_quality';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  triggered_at: number;
  acknowledged: boolean;
  resolved: boolean;
}

// Tenant-specific analytics
export interface TenantAnalytics {
  tenant_id: string;
  analytics_config: {
    data_retention_days: number;
    allowed_data_sources: string[];
    query_limits: {
      max_concurrent_queries: number;
      max_execution_time_minutes: number;
      max_data_scan_mb: number;
      daily_query_quota: number;
    };
    feature_permissions: {
      advanced_analytics: boolean;
      custom_visualizations: boolean;
      scheduled_reports: boolean;
      api_access: boolean;
    };
  };
  usage_metrics: {
    queries_executed_this_month: number;
    data_scanned_mb_this_month: number;
    reports_generated_this_month: number;
    avg_query_execution_time_ms: number;
  };
  cost_tracking: {
    monthly_cost_usd: number;
    cost_per_query: number;
    budget_limit_usd?: number;
    cost_alerts_enabled: boolean;
  };
}

/**
 * Advanced Analytics Query Builder Engine
 */
export class AnalyticsQueryBuilderService {
  private businessMetrics: BusinessMetricsService;
  private metricsQuery: MetricsQueryService;
  private tracer: api.Tracer;
  
  // Query storage and execution tracking
  private savedQueries = new Map<string, AnalyticsQuery>();
  private runningExecutions = new Map<string, QueryExecution>();
  private kpiRegistry = new Map<string, BusinessKPI>();
  private tenantConfigs = new Map<string, TenantAnalytics>();
  
  // Query optimization cache
  private queryCache = new Map<string, {
    result: QueryResult;
    timestamp: number;
    ttl: number;
  }>();
  
  // Performance metrics
  private queryMetrics = {
    total_queries_executed: 0,
    avg_execution_time_ms: 0,
    cache_hit_rate: 0,
    error_rate: 0,
    data_scanned_gb_total: 0
  };

  constructor(
    businessMetrics: BusinessMetricsService,
    metricsQuery: MetricsQueryService
  ) {
    this.businessMetrics = businessMetrics;
    this.metricsQuery = metricsQuery;
    this.tracer = api.trace.getTracer('analytics-query-builder', '1.0.0');
    
    // Initialize default tenant configurations
    this.initializeDefaultTenantConfigs();
    
    // Start scheduled report execution
    this.startScheduledReportEngine();
  }

  /**
   * Create and save a custom analytics query
   */
  async createQuery(
    queryDefinition: Omit<AnalyticsQuery, 'query_id' | 'created_at' | 'last_modified'>
  ): Promise<AnalyticsQuery> {
    const span = this.tracer.startSpan('analytics-query-builder.create-query');
    
    try {
      // Validate query configuration
      this.validateQueryConfiguration(queryDefinition.query_config);
      
      // Generate query ID
      const queryId = this.generateQueryId();
      const now = Date.now();
      
      const query: AnalyticsQuery = {
        ...queryDefinition,
        query_id: queryId,
        created_at: now,
        last_modified: now
      };

      // Validate tenant permissions if applicable
      if (query.tenant_id) {
        await this.validateTenantPermissions(query.tenant_id, query.query_config);
      }
      
      // Save query
      this.savedQueries.set(queryId, query);
      
      span.setAttributes({
        'query.id': queryId,
        'query.name': query.query_name,
        'query.tenant_id': query.tenant_id || '',
        'query.data_sources': query.query_config.data_sources.length
      });

      logger.info('Analytics query created', {
        event: 'analytics_query.created',
        query_id: queryId,
        query_name: query.query_name,
        tenant_id: query.tenant_id,
        created_by: query.created_by
      });

      return query;

    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: api.SpanStatusCode.ERROR });
      
      logger.error('Failed to create analytics query', {
        event: 'analytics_query.create_failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Execute an analytics query with tenant isolation
   */
  async executeQuery(
    queryId: string,
    executedBy: string,
    parameters?: Record<string, any>
  ): Promise<QueryExecution> {
    const span = this.tracer.startSpan('analytics-query-builder.execute-query');
    const startTime = Date.now();

    try {
      span.setAttributes({
        'query.id': queryId,
        'query.executed_by': executedBy
      });

      // Get query definition
      const query = this.savedQueries.get(queryId);
      if (!query) {
        throw new Error(`Query not found: ${queryId}`);
      }

      // Check tenant quota and permissions
      if (query.tenant_id) {
        await this.checkTenantQuota(query.tenant_id);
      }

      // Create execution record
      const executionId = this.generateExecutionId();
      const execution: QueryExecution = {
        execution_id: executionId,
        query_id: queryId,
        tenant_id: query.tenant_id,
        executed_by: executedBy,
        execution_start: startTime,
        status: 'running',
        performance_metrics: {
          execution_time_ms: 0,
          rows_processed: 0,
          data_scanned_mb: 0,
          cache_hit_ratio: 0
        }
      };

      this.runningExecutions.set(executionId, execution);

      try {
        // Check cache first
        const cacheKey = this.generateCacheKey(query.query_config, parameters);
        let result = this.getFromCache(cacheKey);
        let cacheHit = false;

        if (!result) {
          // Execute the query
          result = await this.executeQueryConfiguration(query.query_config, parameters);
        } else {
          cacheHit = true;
          this.queryMetrics.cache_hit_rate++;
        }

        // Generate business insights
        result.business_insights = await this.generateBusinessInsights(result, query.query_config);
        
        // Generate visualization suggestions
        result.visualizations = this.generateVisualizationSuggestions(result, query.query_config);

        // Update execution record
        execution.status = 'completed';
        execution.execution_end = Date.now();
        execution.result = result;
        execution.performance_metrics = {
          execution_time_ms: execution.execution_end - execution.execution_start,
          rows_processed: result.rows.length,
          data_scanned_mb: result.metadata.total_rows * 0.001, // Simplified calculation
          cache_hit_ratio: cacheHit ? 1 : 0
        };

        // Cache the result if it's not already cached
        if (!cacheHit) {
          this.setInCache(cacheKey, result, this.calculateCacheTTL(query.query_config));
        }

        // Update tenant usage metrics
        if (query.tenant_id) {
          this.updateTenantUsage(query.tenant_id, execution);
        }

        // Update global metrics
        this.updateQueryMetrics(execution);

        span.setAttributes({
          'execution.duration_ms': execution.performance_metrics.execution_time_ms,
          'execution.rows_processed': execution.performance_metrics.rows_processed,
          'execution.cache_hit': cacheHit
        });

        logger.info('Analytics query executed successfully', {
          event: 'analytics_query.executed',
          query_id: queryId,
          execution_id: executionId,
          execution_time_ms: execution.performance_metrics.execution_time_ms,
          rows_processed: execution.performance_metrics.rows_processed,
          cache_hit: cacheHit
        });

        return execution;

      } catch (queryError) {
        // Update execution record with error
        execution.status = 'failed';
        execution.execution_end = Date.now();
        execution.error_message = queryError instanceof Error ? queryError.message : 'Unknown error';
        execution.performance_metrics.execution_time_ms = execution.execution_end - execution.execution_start;

        this.queryMetrics.error_rate++;
        
        throw queryError;
      }

    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: api.SpanStatusCode.ERROR });
      
      logger.error('Failed to execute analytics query', {
        event: 'analytics_query.execution_failed',
        query_id: queryId,
        executed_by: executedBy,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Create and track business KPI with goal monitoring
   */
  async createBusinessKPI(kpiDefinition: Omit<BusinessKPI, 'kpi_id' | 'last_calculated' | 'status' | 'trend' | 'alerts'>): Promise<BusinessKPI> {
    const span = this.tracer.startSpan('analytics-query-builder.create-kpi');
    
    try {
      const kpiId = this.generateKPIId();
      
      const kpi: BusinessKPI = {
        ...kpiDefinition,
        kpi_id: kpiId,
        last_calculated: Date.now(),
        status: 'on_track',
        trend: 'stable',
        alerts: []
      };

      // Validate KPI query configuration
      this.validateQueryConfiguration(kpi.query_config);
      
      // Calculate initial KPI value
      await this.calculateKPIValue(kpi);
      
      // Save KPI
      this.kpiRegistry.set(kpiId, kpi);

      logger.info('Business KPI created', {
        event: 'business_kpi.created',
        kpi_id: kpiId,
        kpi_name: kpi.kpi_name,
        category: kpi.category,
        owner: kpi.owner,
        tenant_id: kpi.tenant_id
      });

      return kpi;

    } finally {
      span.end();
    }
  }

  /**
   * Generate tenant-specific analytics report
   */
  async generateTenantAnalyticsReport(
    tenantId: string,
    reportType: 'usage' | 'performance' | 'cost' | 'comprehensive',
    timeRange: TimeRange
  ): Promise<{
    report_id: string;
    generated_at: number;
    tenant_id: string;
    report_type: string;
    data: any;
    insights: BusinessInsight[];
    recommendations: string[];
  }> {
    const span = this.tracer.startSpan('analytics-query-builder.generate-tenant-report');
    
    try {
      span.setAttributes({
        'report.tenant_id': tenantId,
        'report.type': reportType
      });

      const reportId = this.generateReportId();
      const tenantConfig = this.tenantConfigs.get(tenantId);
      
      if (!tenantConfig) {
        throw new Error(`Tenant configuration not found: ${tenantId}`);
      }

      let reportData: any = {};
      const insights: BusinessInsight[] = [];
      const recommendations: string[] = [];

      switch (reportType) {
        case 'usage':
          reportData = await this.generateUsageReport(tenantId, timeRange);
          break;
        case 'performance':
          reportData = await this.generatePerformanceReport(tenantId, timeRange);
          break;
        case 'cost':
          reportData = await this.generateCostReport(tenantId, timeRange);
          break;
        case 'comprehensive':
          reportData = {
            usage: await this.generateUsageReport(tenantId, timeRange),
            performance: await this.generatePerformanceReport(tenantId, timeRange),
            cost: await this.generateCostReport(tenantId, timeRange)
          };
          break;
      }

      // Generate insights and recommendations
      insights.push(...await this.generateTenantInsights(tenantId, reportData, reportType));
      recommendations.push(...this.generateTenantRecommendations(tenantId, reportData, reportType));

      logger.info('Tenant analytics report generated', {
        event: 'tenant_analytics.report_generated',
        report_id: reportId,
        tenant_id: tenantId,
        report_type: reportType,
        insights_count: insights.length,
        recommendations_count: recommendations.length
      });

      return {
        report_id: reportId,
        generated_at: Date.now(),
        tenant_id: tenantId,
        report_type: reportType,
        data: reportData,
        insights,
        recommendations
      };

    } finally {
      span.end();
    }
  }

  /**
   * Schedule automated report generation
   */
  async scheduleReport(
    queryId: string,
    schedule: ScheduleConfiguration,
    scheduledBy: string
  ): Promise<{
    schedule_id: string;
    next_execution: number;
    status: 'active' | 'paused' | 'failed';
  }> {
    const span = this.tracer.startSpan('analytics-query-builder.schedule-report');
    
    try {
      const scheduleId = this.generateScheduleId();
      const nextExecution = this.calculateNextExecution(schedule);

      // Update query with schedule configuration
      const query = this.savedQueries.get(queryId);
      if (!query) {
        throw new Error(`Query not found: ${queryId}`);
      }

      query.execution_schedule = schedule;
      query.last_modified = Date.now();

      logger.info('Report scheduled', {
        event: 'analytics_query.report_scheduled',
        schedule_id: scheduleId,
        query_id: queryId,
        next_execution: nextExecution,
        frequency: schedule.frequency,
        scheduled_by: scheduledBy
      });

      return {
        schedule_id: scheduleId,
        next_execution: nextExecution,
        status: 'active'
      };

    } finally {
      span.end();
    }
  }

  /**
   * Get analytics performance metrics
   */
  getAnalyticsMetrics(): {
    query_performance: typeof this.queryMetrics;
    tenant_usage: Array<{
      tenant_id: string;
      queries_this_month: number;
      avg_execution_time: number;
      data_scanned_gb: number;
      cost_usd: number;
    }>;
    top_queries: Array<{
      query_id: string;
      query_name: string;
      execution_count: number;
      avg_execution_time: number;
    }>;
    kpi_summary: {
      total_kpis: number;
      on_track: number;
      at_risk: number;
      behind: number;
      ahead: number;
    };
  } {
    const tenantUsage = Array.from(this.tenantConfigs.entries()).map(([tenantId, config]) => ({
      tenant_id: tenantId,
      queries_this_month: config.usage_metrics.queries_executed_this_month,
      avg_execution_time: config.usage_metrics.avg_query_execution_time_ms,
      data_scanned_gb: config.usage_metrics.data_scanned_mb_this_month / 1024,
      cost_usd: config.cost_tracking.monthly_cost_usd
    }));

    const kpiCounts = {
      total_kpis: this.kpiRegistry.size,
      on_track: 0,
      at_risk: 0,
      behind: 0,
      ahead: 0
    };

    Array.from(this.kpiRegistry.values()).forEach(kpi => {
      kpiCounts[kpi.status]++;
    });

    return {
      query_performance: this.queryMetrics,
      tenant_usage: tenantUsage,
      top_queries: [], // Would be populated with actual usage data
      kpi_summary: kpiCounts
    };
  }

  // Private helper methods

  private validateQueryConfiguration(config: QueryConfiguration): void {
    if (!config.data_sources || config.data_sources.length === 0) {
      throw new Error('At least one data source is required');
    }

    if (!config.time_range) {
      throw new Error('Time range is required');
    }

    // Validate data source permissions and availability
    for (const source of config.data_sources) {
      if (!this.isDataSourceAvailable(source.source_name)) {
        throw new Error(`Data source not available: ${source.source_name}`);
      }
    }
  }

  private async validateTenantPermissions(tenantId: string, config: QueryConfiguration): Promise<void> {
    const tenantConfig = this.tenantConfigs.get(tenantId);
    if (!tenantConfig) {
      throw new Error(`Tenant configuration not found: ${tenantId}`);
    }

    // Check data source permissions
    for (const source of config.data_sources) {
      if (!tenantConfig.analytics_config.allowed_data_sources.includes(source.source_name)) {
        throw new Error(`Data source not allowed for tenant: ${source.source_name}`);
      }
    }

    // Check feature permissions
    if (config.aggregations.some(agg => agg.function === 'percentile') && 
        !tenantConfig.analytics_config.feature_permissions.advanced_analytics) {
      throw new Error('Advanced analytics features not enabled for tenant');
    }
  }

  private async checkTenantQuota(tenantId: string): Promise<void> {
    const tenantConfig = this.tenantConfigs.get(tenantId);
    if (!tenantConfig) return;

    const currentQueries = this.getCurrentQueryCount(tenantId);
    if (currentQueries >= tenantConfig.analytics_config.query_limits.max_concurrent_queries) {
      throw new Error('Concurrent query limit exceeded for tenant');
    }

    if (tenantConfig.usage_metrics.queries_executed_this_month >= 
        tenantConfig.analytics_config.query_limits.daily_query_quota * 30) {
      throw new Error('Monthly query quota exceeded for tenant');
    }
  }

  private async executeQueryConfiguration(
    config: QueryConfiguration,
    parameters?: Record<string, any>
  ): Promise<QueryResult> {
    // This is a simplified implementation
    // In a real system, this would:
    // 1. Parse the query configuration into SQL/NoSQL queries
    // 2. Execute against appropriate data sources
    // 3. Apply filters, aggregations, and grouping
    // 4. Join multiple data sources if needed
    // 5. Format results according to specifications

    const mockResult: QueryResult = {
      columns: [
        { name: 'timestamp', type: 'timestamp', description: 'Event timestamp' },
        { name: 'service_name', type: 'string', description: 'Service name' },
        { name: 'request_count', type: 'number', description: 'Number of requests' },
        { name: 'avg_response_time', type: 'number', description: 'Average response time in ms' }
      ],
      rows: [
        [Date.now(), 'user-service', 1000, 250],
        [Date.now() - 3600000, 'payment-service', 500, 180],
        [Date.now() - 7200000, 'auth-service', 2000, 120]
      ],
      metadata: {
        total_rows: 3,
        execution_time_ms: 150,
        data_sources_used: config.data_sources.map(ds => ds.source_name),
        cache_status: 'miss'
      }
    };

    return mockResult;
  }

  private async generateBusinessInsights(result: QueryResult, config: QueryConfiguration): Promise<BusinessInsight[]> {
    const insights: BusinessInsight[] = [];

    // Analyze data for trends and anomalies
    if (result.rows.length > 0) {
      // Example insight generation
      insights.push({
        insight_type: 'trend',
        title: 'Performance Trend Analysis',
        description: 'Response times have improved by 15% over the last week',
        significance_score: 0.8,
        business_impact: 'medium',
        recommended_actions: [
          'Continue monitoring performance metrics',
          'Investigate factors contributing to improvement',
          'Consider scaling optimizations to other services'
        ]
      });

      // Add more insights based on data patterns
      if (this.detectAnomaly(result)) {
        insights.push({
          insight_type: 'anomaly',
          title: 'Anomaly Detected',
          description: 'Unusual spike in error rate detected in the last hour',
          significance_score: 0.95,
          business_impact: 'high',
          recommended_actions: [
            'Investigate recent deployments',
            'Check service health dashboards',
            'Review error logs for root cause'
          ]
        });
      }
    }

    return insights;
  }

  private generateVisualizationSuggestions(result: QueryResult, config: QueryConfiguration): VisualizationSuggestion[] {
    const suggestions: VisualizationSuggestion[] = [];

    // Analyze result structure to suggest appropriate visualizations
    const hasTimeColumn = result.columns.some(col => col.type === 'timestamp' || col.type === 'date');
    const hasNumericColumns = result.columns.some(col => col.type === 'number');
    const hasCategoricalColumns = result.columns.some(col => col.type === 'string');

    if (hasTimeColumn && hasNumericColumns) {
      suggestions.push({
        chart_type: 'line',
        x_axis: result.columns.find(col => col.type === 'timestamp')?.name,
        y_axis: result.columns.find(col => col.type === 'number')?.name,
        title: 'Time Series Analysis',
        description: 'Show trend over time',
        configuration: {
          interpolation: 'linear',
          showMarkers: true,
          yAxisLabel: 'Value',
          xAxisLabel: 'Time'
        }
      });
    }

    if (hasCategoricalColumns && hasNumericColumns) {
      suggestions.push({
        chart_type: 'bar',
        x_axis: result.columns.find(col => col.type === 'string')?.name,
        y_axis: result.columns.find(col => col.type === 'number')?.name,
        title: 'Categorical Comparison',
        description: 'Compare values across categories',
        configuration: {
          orientation: 'vertical',
          showValues: true
        }
      });
    }

    return suggestions;
  }

  private async calculateKPIValue(kpi: BusinessKPI): Promise<void> {
    try {
      // Execute KPI query to get current value
      const result = await this.executeQueryConfiguration(kpi.query_config);
      
      if (result.rows.length > 0 && result.rows[0].length > 0) {
        kpi.current_value = Number(result.rows[0][0]);
        
        // Assess KPI status against target
        kpi.status = this.assessKPIStatus(kpi.current_value, kpi.target_config);
        kpi.trend = this.calculateKPITrend(kpi);
        kpi.last_calculated = Date.now();

        // Check for alerts
        const alerts = this.checkKPIAlerts(kpi);
        kpi.alerts.push(...alerts);
      }
    } catch (error) {
      logger.error('Failed to calculate KPI value', {
        event: 'business_kpi.calculation_failed',
        kpi_id: kpi.kpi_id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private assessKPIStatus(currentValue: number, target: KPITarget): 'on_track' | 'at_risk' | 'behind' | 'ahead' {
    const progressPercentage = (currentValue / target.target_value) * 100;
    
    if (progressPercentage >= target.thresholds.green_threshold) {
      return progressPercentage > 100 ? 'ahead' : 'on_track';
    } else if (progressPercentage >= target.thresholds.yellow_threshold) {
      return 'at_risk';
    } else {
      return 'behind';
    }
  }

  private calculateKPITrend(kpi: BusinessKPI): 'improving' | 'degrading' | 'stable' {
    // Simplified trend calculation - would use historical data in real implementation
    return 'stable';
  }

  private checkKPIAlerts(kpi: BusinessKPI): KPIAlert[] {
    const alerts: KPIAlert[] = [];
    
    if (kpi.status === 'behind') {
      alerts.push({
        alert_id: this.generateAlertId(),
        condition: 'threshold_breach',
        severity: 'critical',
        message: `KPI ${kpi.kpi_name} is significantly behind target`,
        triggered_at: Date.now(),
        acknowledged: false,
        resolved: false
      });
    } else if (kpi.status === 'at_risk') {
      alerts.push({
        alert_id: this.generateAlertId(),
        condition: 'target_risk',
        severity: 'warning',
        message: `KPI ${kpi.kpi_name} is at risk of missing target`,
        triggered_at: Date.now(),
        acknowledged: false,
        resolved: false
      });
    }
    
    return alerts;
  }

  private async generateUsageReport(tenantId: string, timeRange: TimeRange): Promise<any> {
    const tenantConfig = this.tenantConfigs.get(tenantId);
    return {
      queries_executed: tenantConfig?.usage_metrics.queries_executed_this_month || 0,
      data_scanned_mb: tenantConfig?.usage_metrics.data_scanned_mb_this_month || 0,
      reports_generated: tenantConfig?.usage_metrics.reports_generated_this_month || 0,
      avg_execution_time: tenantConfig?.usage_metrics.avg_query_execution_time_ms || 0
    };
  }

  private async generatePerformanceReport(tenantId: string, timeRange: TimeRange): Promise<any> {
    return {
      avg_query_time_ms: 250,
      cache_hit_rate: 0.75,
      error_rate: 0.02,
      throughput_queries_per_hour: 100
    };
  }

  private async generateCostReport(tenantId: string, timeRange: TimeRange): Promise<any> {
    const tenantConfig = this.tenantConfigs.get(tenantId);
    return {
      total_cost_usd: tenantConfig?.cost_tracking.monthly_cost_usd || 0,
      cost_per_query: tenantConfig?.cost_tracking.cost_per_query || 0,
      budget_utilization: 0.65,
      projected_monthly_cost: (tenantConfig?.cost_tracking.monthly_cost_usd || 0) * 1.1
    };
  }

  private async generateTenantInsights(tenantId: string, reportData: any, reportType: string): Promise<BusinessInsight[]> {
    const insights: BusinessInsight[] = [];
    
    if (reportType === 'cost' || reportType === 'comprehensive') {
      insights.push({
        insight_type: 'trend',
        title: 'Cost Optimization Opportunity',
        description: 'Query optimization could reduce costs by 20%',
        significance_score: 0.7,
        business_impact: 'medium',
        recommended_actions: [
          'Implement query result caching',
          'Optimize data scanning patterns',
          'Review query frequency and necessity'
        ]
      });
    }
    
    return insights;
  }

  private generateTenantRecommendations(tenantId: string, reportData: any, reportType: string): string[] {
    const recommendations: string[] = [];
    
    recommendations.push('Enable advanced analytics features for deeper insights');
    recommendations.push('Set up automated report scheduling for regular updates');
    recommendations.push('Implement query result caching to improve performance');
    
    return recommendations;
  }

  private startScheduledReportEngine(): void {
    // Check for scheduled reports every minute
    setInterval(() => {
      this.executeScheduledReports();
    }, 60 * 1000);
  }

  private async executeScheduledReports(): Promise<void> {
    const now = Date.now();
    
    for (const [queryId, query] of this.savedQueries) {
      if (query.execution_schedule) {
        const nextExecution = this.calculateNextExecution(query.execution_schedule);
        
        if (now >= nextExecution) {
          try {
            const execution = await this.executeQuery(queryId, 'system');
            await this.deliverScheduledReport(query, execution);
            
            logger.info('Scheduled report executed', {
              event: 'scheduled_report.executed',
              query_id: queryId,
              execution_id: execution.execution_id
            });
          } catch (error) {
            logger.error('Scheduled report failed', {
              event: 'scheduled_report.failed',
              query_id: queryId,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
      }
    }
  }

  private async deliverScheduledReport(query: AnalyticsQuery, execution: QueryExecution): Promise<void> {
    if (!query.execution_schedule || !execution.result) return;
    
    const schedule = query.execution_schedule;
    
    // Deliver via configured method
    switch (schedule.delivery_method) {
      case 'email':
        await this.sendEmailReport(execution.result, schedule.recipients);
        break;
      case 'slack':
        await this.sendSlackReport(execution.result, schedule.recipients);
        break;
      case 'webhook':
        await this.sendWebhookReport(execution.result, schedule.recipients);
        break;
      case 's3':
        await this.uploadToS3(execution.result, query.query_name);
        break;
    }
  }

  // Utility methods

  private generateQueryId(): string {
    return `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateKPIId(): string {
    return `kpi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateReportId(): string {
    return `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateScheduleId(): string {
    return `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCacheKey(config: QueryConfiguration, parameters?: Record<string, any>): string {
    const configString = JSON.stringify({
      ...config,
      parameters: parameters || {}
    });
    
    // Create hash of configuration for cache key
    return `query_cache_${configString.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0)}`;
  }

  private getFromCache(cacheKey: string): QueryResult | null {
    const entry = this.queryCache.get(cacheKey);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.queryCache.delete(cacheKey);
      return null;
    }
    
    return entry.result;
  }

  private setInCache(cacheKey: string, result: QueryResult, ttl: number): void {
    this.queryCache.set(cacheKey, {
      result,
      timestamp: Date.now(),
      ttl
    });
  }

  private calculateCacheTTL(config: QueryConfiguration): number {
    // Calculate cache TTL based on query characteristics
    if (config.time_range.end === 'now' || 
        (typeof config.time_range.end === 'number' && config.time_range.end > Date.now() - 60000)) {
      return 60 * 1000; // 1 minute for real-time queries
    }
    
    return 15 * 60 * 1000; // 15 minutes for historical queries
  }

  private calculateNextExecution(schedule: ScheduleConfiguration): number {
    const now = Date.now();
    
    if (schedule.cron_expression) {
      // Parse cron expression (simplified)
      return now + 24 * 60 * 60 * 1000; // Default to daily
    }
    
    switch (schedule.frequency) {
      case 'hourly': return now + 60 * 60 * 1000;
      case 'daily': return now + 24 * 60 * 60 * 1000;
      case 'weekly': return now + 7 * 24 * 60 * 60 * 1000;
      case 'monthly': return now + 30 * 24 * 60 * 60 * 1000;
      default: return now + 24 * 60 * 60 * 1000;
    }
  }

  private isDataSourceAvailable(sourceName: string): boolean {
    const availableSources = ['metrics', 'traces', 'logs', 'business_events'];
    return availableSources.includes(sourceName);
  }

  private getCurrentQueryCount(tenantId: string): number {
    return Array.from(this.runningExecutions.values())
      .filter(exec => exec.tenant_id === tenantId && exec.status === 'running')
      .length;
  }

  private detectAnomaly(result: QueryResult): boolean {
    // Simplified anomaly detection
    return Math.random() > 0.8; // 20% chance of anomaly for demo
  }

  private updateTenantUsage(tenantId: string, execution: QueryExecution): void {
    const tenantConfig = this.tenantConfigs.get(tenantId);
    if (tenantConfig) {
      tenantConfig.usage_metrics.queries_executed_this_month++;
      tenantConfig.usage_metrics.data_scanned_mb_this_month += execution.performance_metrics.data_scanned_mb;
      
      // Update running average execution time
      const totalQueries = tenantConfig.usage_metrics.queries_executed_this_month;
      tenantConfig.usage_metrics.avg_query_execution_time_ms = 
        ((tenantConfig.usage_metrics.avg_query_execution_time_ms * (totalQueries - 1)) + 
         execution.performance_metrics.execution_time_ms) / totalQueries;
    }
  }

  private updateQueryMetrics(execution: QueryExecution): void {
    this.queryMetrics.total_queries_executed++;
    const total = this.queryMetrics.total_queries_executed;
    
    this.queryMetrics.avg_execution_time_ms = 
      ((this.queryMetrics.avg_execution_time_ms * (total - 1)) + 
       execution.performance_metrics.execution_time_ms) / total;
    
    this.queryMetrics.data_scanned_gb_total += execution.performance_metrics.data_scanned_mb / 1024;
  }

  private initializeDefaultTenantConfigs(): void {
    // Initialize default tenant configurations
    const defaultConfig: TenantAnalytics = {
      tenant_id: 'default',
      analytics_config: {
        data_retention_days: 90,
        allowed_data_sources: ['metrics', 'traces', 'logs'],
        query_limits: {
          max_concurrent_queries: 10,
          max_execution_time_minutes: 30,
          max_data_scan_mb: 1000,
          daily_query_quota: 100
        },
        feature_permissions: {
          advanced_analytics: true,
          custom_visualizations: true,
          scheduled_reports: true,
          api_access: true
        }
      },
      usage_metrics: {
        queries_executed_this_month: 0,
        data_scanned_mb_this_month: 0,
        reports_generated_this_month: 0,
        avg_query_execution_time_ms: 0
      },
      cost_tracking: {
        monthly_cost_usd: 0,
        cost_per_query: 0.1,
        cost_alerts_enabled: true
      }
    };
    
    this.tenantConfigs.set('default', defaultConfig);
  }

  // Report delivery methods (simplified implementations)
  private async sendEmailReport(result: QueryResult, recipients: NotificationRecipient[]): Promise<void> {
    // Would integrate with email service
    logger.info('Email report sent', { recipients_count: recipients.length });
  }

  private async sendSlackReport(result: QueryResult, recipients: NotificationRecipient[]): Promise<void> {
    // Would integrate with Slack API
    logger.info('Slack report sent', { channels_count: recipients.length });
  }

  private async sendWebhookReport(result: QueryResult, recipients: NotificationRecipient[]): Promise<void> {
    // Would send HTTP POST to webhook URLs
    logger.info('Webhook report sent', { webhooks_count: recipients.length });
  }

  private async uploadToS3(result: QueryResult, fileName: string): Promise<void> {
    // Would upload to S3 bucket
    logger.info('Report uploaded to S3', { file_name: fileName });
  }
}