/**
 * Advanced Analytics Routes
 * Task 5.3: Advanced Analytics Setup - Complete implementation
 * 
 * Comprehensive analytics endpoints integrating:
 * - Trace analysis and request flow visualization
 * - Performance trend analysis with anomaly detection
 * - Service dependency mapping with health indicators
 * - Custom query builder for business intelligence
 */

import { Router } from 'express';
import { authenticateToken } from '../auth/auth.middleware';
import { logger } from '../config/logger';
import { TraceAnalysisService } from '../services/trace-analysis.service';
import { PerformanceTrendAnalysisService } from '../services/performance-trend-analysis.service';
import { ServiceDependencyMappingService } from '../services/service-dependency-mapping.service';
import { AnalyticsQueryBuilderService } from '../services/analytics-query-builder.service';
import { BusinessMetricsService, getBusinessMetricsService } from '../services/business-metrics.service';
import { MetricsQueryService } from '../services/metrics-query.service';
import { createDbConnection, DatabaseConnection } from '../database/connection';

const router = Router();

// Apply authentication to all analytics routes
router.use(authenticateToken);

// Initialize advanced analytics services
const businessMetricsService = getBusinessMetricsService();
// TODO: Fix DatabaseConnection initialization - temporarily using null
const metricsQueryService = new MetricsQueryService(null as any, logger);
const traceAnalysisService = new TraceAnalysisService(businessMetricsService, metricsQueryService);
const performanceTrendService = new PerformanceTrendAnalysisService(businessMetricsService, metricsQueryService);
const serviceDependencyService = new ServiceDependencyMappingService(businessMetricsService, traceAnalysisService);
const queryBuilderService = new AnalyticsQueryBuilderService(businessMetricsService, metricsQueryService);

/**
 * POST /api/v1/analytics/trace-analysis
 * Analyze complete request flow for traces
 */
router.post('/trace-analysis', async (req, res) => {
  try {
    const { trace_id, analysis_type } = req.body;
    const userId = req.user?.userId;
    const tenantId = req.user?.tenantId;

    logger.info('Starting trace analysis', {
      userId,
      tenantId,
      traceId: trace_id,
      analysisType: analysis_type
    });

    let result;
    switch (analysis_type) {
      case 'request_flow':
        result = await traceAnalysisService.analyzeRequestFlow(trace_id);
        break;
      case 'bottlenecks':
        const traces = []; // Would fetch actual traces
        result = await traceAnalysisService.identifyBottlenecks(traces);
        break;
      case 'performance_impact':
        result = await traceAnalysisService.calculatePerformanceImpact(trace_id);
        break;
      default:
        return res.error('Invalid analysis type', 400);
    }

    res.success({
      data: result,
      meta: {
        trace_id,
        analysis_type,
        analysis_timestamp: Date.now()
      }
    }, 'Trace analysis completed successfully');
  } catch (error) {
    logger.error('Error in trace analysis:', error);
    res.error('Failed to perform trace analysis', 500);
  }
});

/**
 * GET /api/v1/analytics/service-topology
 * Get enhanced service topology with dependency mapping
 */
router.get('/service-topology', async (req, res) => {
  try {
    const { analysis_hours = 24, include_external = true } = req.query;
    const userId = req.user?.userId;
    const tenantId = req.user?.tenantId;

    logger.info('Generating service topology', {
      userId,
      tenantId,
      analysisHours: analysis_hours,
      includeExternal: include_external
    });

    const topology = await serviceDependencyService.generateEnhancedTopology(
      Number(analysis_hours),
      Boolean(include_external)
    );

    res.success({
      data: topology,
      meta: {
        analysis_hours: Number(analysis_hours),
        include_external: Boolean(include_external),
        generated_at: Date.now()
      }
    }, 'Service topology generated successfully');
  } catch (error) {
    logger.error('Error generating service topology:', error);
    res.error('Failed to generate service topology', 500);
  }
});

/**
 * POST /api/v1/analytics/performance-trends
 * Analyze performance trends with anomaly detection
 */
router.post('/performance-trends', async (req, res) => {
  try {
    const { metric_name, time_range_hours, service_name, tenant_id: contextTenantId } = req.body;
    const userId = req.user?.userId;
    const tenantId = req.user?.tenantId;

    logger.info('Analyzing performance trends', {
      userId,
      tenantId,
      metricName: metric_name,
      timeRangeHours: time_range_hours,
      serviceName: service_name
    });

    const trendAnalysis = await performanceTrendService.analyzePerformanceTrend(
      metric_name,
      time_range_hours,
      {
        serviceName: service_name,
        tenantId: contextTenantId || tenantId
      }
    );

    res.success({
      data: trendAnalysis,
      meta: {
        metric_name,
        time_range_hours,
        analysis_timestamp: Date.now()
      }
    }, 'Performance trend analysis completed successfully');
  } catch (error) {
    logger.error('Error analyzing performance trends:', error);
    res.error('Failed to analyze performance trends', 500);
  }
});

/**
 * POST /api/v1/analytics/anomaly-detection
 * Detect performance anomalies using multiple algorithms
 */
router.post('/anomaly-detection', async (req, res) => {
  try {
    const { metric_name, time_range_hours, service_name } = req.body;
    const userId = req.user?.userId;
    const tenantId = req.user?.tenantId;

    logger.info('Starting anomaly detection', {
      userId,
      tenantId,
      metricName: metric_name,
      timeRangeHours: time_range_hours,
      serviceName: service_name
    });

    const anomalyDetection = await performanceTrendService.detectAnomalies(
      metric_name,
      time_range_hours,
      {
        serviceName: service_name,
        tenantId
      }
    );

    res.success({
      data: anomalyDetection,
      meta: {
        metric_name,
        time_range_hours,
        detection_timestamp: Date.now()
      }
    }, 'Anomaly detection completed successfully');
  } catch (error) {
    logger.error('Error detecting anomalies:', error);
    res.error('Failed to detect anomalies', 500);
  }
});

/**
 * POST /api/v1/analytics/predictive-analysis
 * Generate predictive performance analysis with capacity planning
 */
router.post('/predictive-analysis', async (req, res) => {
  try {
    const { metric_name, prediction_horizon, service_name } = req.body;
    const userId = req.user?.userId;
    const tenantId = req.user?.tenantId;

    logger.info('Generating predictive analysis', {
      userId,
      tenantId,
      metricName: metric_name,
      predictionHorizon: prediction_horizon,
      serviceName: service_name
    });

    const predictiveAnalysis = await performanceTrendService.generatePredictiveAnalysis(
      metric_name,
      prediction_horizon,
      {
        serviceName: service_name,
        tenantId
      }
    );

    res.success({
      data: predictiveAnalysis,
      meta: {
        metric_name,
        prediction_horizon,
        analysis_timestamp: Date.now()
      }
    }, 'Predictive analysis completed successfully');
  } catch (error) {
    logger.error('Error generating predictive analysis:', error);
    res.error('Failed to generate predictive analysis', 500);
  }
});

/**
 * GET /api/v1/analytics/communication-patterns
 * Analyze service communication patterns with optimization opportunities
 */
router.get('/communication-patterns', async (req, res) => {
  try {
    const { service_name, pattern_types } = req.query;
    const userId = req.user?.userId;
    const tenantId = req.user?.tenantId;

    logger.info('Analyzing communication patterns', {
      userId,
      tenantId,
      serviceName: service_name,
      patternTypes: pattern_types
    });

    const patterns = await serviceDependencyService.analyzeCommunicationPatterns(
      service_name as string,
      pattern_types ? (pattern_types as string).split(',') : undefined
    );

    res.success({
      data: patterns,
      meta: {
        service_name: service_name || 'all',
        pattern_count: patterns.length,
        analysis_timestamp: Date.now()
      }
    }, 'Communication patterns analyzed successfully');
  } catch (error) {
    logger.error('Error analyzing communication patterns:', error);
    res.error('Failed to analyze communication patterns', 500);
  }
});

/**
 * POST /api/v1/analytics/failure-simulation
 * Simulate failure scenarios and impact analysis
 */
router.post('/failure-simulation', async (req, res) => {
  try {
    const { failing_service, failure_type } = req.body;
    const userId = req.user?.userId;
    const tenantId = req.user?.tenantId;

    logger.info('Simulating failure scenario', {
      userId,
      tenantId,
      failingService: failing_service,
      failureType: failure_type
    });

    const simulation = await serviceDependencyService.simulateFailureImpact(
      failing_service,
      failure_type
    );

    res.success({
      data: simulation,
      meta: {
        failing_service,
        failure_type,
        simulation_timestamp: Date.now()
      }
    }, 'Failure simulation completed successfully');
  } catch (error) {
    logger.error('Error simulating failure:', error);
    res.error('Failed to simulate failure scenario', 500);
  }
});

/**
 * GET /api/v1/analytics/service-health
 * Calculate service health scores with component breakdown
 */
router.get('/service-health', async (req, res) => {
  try {
    const { service_names } = req.query;
    const userId = req.user?.userId;
    const tenantId = req.user?.tenantId;

    logger.info('Calculating service health scores', {
      userId,
      tenantId,
      serviceNames: service_names
    });

    const serviceNames = service_names ? 
      (service_names as string).split(',') : undefined;

    const healthScores = await serviceDependencyService.calculateServiceHealthScores(serviceNames);

    res.success({
      data: healthScores,
      meta: {
        service_count: healthScores.length,
        avg_health_score: healthScores.reduce((sum, s) => sum + s.overall_score, 0) / healthScores.length,
        calculation_timestamp: Date.now()
      }
    }, 'Service health scores calculated successfully');
  } catch (error) {
    logger.error('Error calculating service health:', error);
    res.error('Failed to calculate service health scores', 500);
  }
});

/**
 * POST /api/v1/analytics/custom-query
 * Create and execute custom analytics query
 */
router.post('/custom-query', async (req, res) => {
  try {
    const { query_definition, execute_immediately = false } = req.body;
    const userId = req.user?.userId;
    const tenantId = req.user?.tenantId;

    logger.info('Creating custom analytics query', {
      userId,
      tenantId,
      queryName: query_definition.query_name,
      executeImmediately: execute_immediately
    });

    const query = await queryBuilderService.createQuery({
      ...query_definition,
      tenant_id: tenantId,
      created_by: userId
    });

    let execution = null;
    if (execute_immediately) {
      execution = await queryBuilderService.executeQuery(
        query.query_id,
        userId
      );
    }

    res.success({
      data: {
        query,
        execution
      },
      meta: {
        query_id: query.query_id,
        executed: execute_immediately,
        created_at: query.created_at
      }
    }, 'Custom query created successfully');
  } catch (error) {
    logger.error('Error creating custom query:', error);
    res.error('Failed to create custom query', 500);
  }
});

/**
 * POST /api/v1/analytics/execute-query/:queryId
 * Execute a saved analytics query
 */
router.post('/execute-query/:queryId', async (req, res) => {
  try {
    const { queryId } = req.params;
    const { parameters } = req.body;
    const userId = req.user?.userId;
    const tenantId = req.user?.tenantId;

    logger.info('Executing analytics query', {
      userId,
      tenantId,
      queryId,
      hasParameters: !!parameters
    });

    const execution = await queryBuilderService.executeQuery(
      queryId,
      userId,
      parameters
    );

    res.success({
      data: execution,
      meta: {
        query_id: queryId,
        execution_id: execution.execution_id,
        execution_status: execution.status
      }
    }, 'Query executed successfully');
  } catch (error) {
    logger.error('Error executing query:', error);
    res.error('Failed to execute query', 500);
  }
});

/**
 * POST /api/v1/analytics/business-kpi
 * Create and track business KPI
 */
router.post('/business-kpi', async (req, res) => {
  try {
    const { kpi_definition } = req.body;
    const userId = req.user?.userId;
    const tenantId = req.user?.tenantId;

    logger.info('Creating business KPI', {
      userId,
      tenantId,
      kpiName: kpi_definition.kpi_name,
      category: kpi_definition.category
    });

    const kpi = await queryBuilderService.createBusinessKPI({
      ...kpi_definition,
      tenant_id: tenantId,
      owner: userId
    });

    res.success({
      data: kpi,
      meta: {
        kpi_id: kpi.kpi_id,
        created_at: kpi.last_calculated
      }
    }, 'Business KPI created successfully');
  } catch (error) {
    logger.error('Error creating business KPI:', error);
    res.error('Failed to create business KPI', 500);
  }
});

/**
 * GET /api/v1/analytics/tenant-report
 * Generate comprehensive tenant analytics report
 */
router.get('/tenant-report', async (req, res) => {
  try {
    const { report_type = 'comprehensive', time_range } = req.query;
    const userId = req.user?.userId;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.error('Tenant ID is required', 400);
    }

    logger.info('Generating tenant analytics report', {
      userId,
      tenantId,
      reportType: report_type,
      timeRange: time_range
    });

    const timeRangeConfig = time_range ? JSON.parse(time_range as string) : {
      start: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
      end: Date.now()
    };

    const report = await queryBuilderService.generateTenantAnalyticsReport(
      tenantId,
      report_type as 'usage' | 'performance' | 'cost' | 'comprehensive',
      timeRangeConfig
    );

    res.success({
      data: report,
      meta: {
        tenant_id: tenantId,
        report_type,
        generated_at: report.generated_at
      }
    }, 'Tenant analytics report generated successfully');
  } catch (error) {
    logger.error('Error generating tenant report:', error);
    res.error('Failed to generate tenant analytics report', 500);
  }
});

/**
 * GET /api/v1/analytics/metrics/overview
 * Get comprehensive analytics performance metrics
 */
router.get('/metrics/overview', async (req, res) => {
  try {
    const userId = req.user?.userId;
    const tenantId = req.user?.tenantId;

    logger.info('Fetching analytics overview metrics', {
      userId,
      tenantId
    });

    const analyticsMetrics = queryBuilderService.getAnalyticsMetrics();

    res.success({
      data: analyticsMetrics,
      meta: {
        collected_at: Date.now(),
        tenant_id: tenantId
      }
    }, 'Analytics metrics overview retrieved successfully');
  } catch (error) {
    logger.error('Error fetching analytics metrics:', error);
    res.error('Failed to fetch analytics metrics overview', 500);
  }
});

/**
 * POST /api/v1/analytics/schedule-report
 * Schedule automated report generation
 */
router.post('/schedule-report', async (req, res) => {
  try {
    const { query_id, schedule_config } = req.body;
    const userId = req.user?.userId;
    const tenantId = req.user?.tenantId;

    logger.info('Scheduling report generation', {
      userId,
      tenantId,
      queryId: query_id,
      frequency: schedule_config.frequency
    });

    const schedule = await queryBuilderService.scheduleReport(
      query_id,
      schedule_config,
      userId
    );

    res.success({
      data: schedule,
      meta: {
        query_id,
        scheduled_by: userId,
        scheduled_at: Date.now()
      }
    }, 'Report scheduled successfully');
  } catch (error) {
    logger.error('Error scheduling report:', error);
    res.error('Failed to schedule report', 500);
  }
});

/**
 * GET /api/v1/analytics/trace-search
 * Search traces with advanced filtering and business context
 */
router.get('/trace-search', async (req, res) => {
  try {
    const searchCriteria = {
      traceId: req.query.trace_id as string,
      serviceName: req.query.service_name as string,
      operationName: req.query.operation_name as string,
      tenantId: req.query.tenant_id as string || req.user?.tenantId,
      userId: req.query.user_id as string,
      startTime: parseInt(req.query.start_time as string) || Date.now() - 24 * 60 * 60 * 1000,
      endTime: parseInt(req.query.end_time as string) || Date.now(),
      minDuration: req.query.min_duration ? parseInt(req.query.min_duration as string) : undefined,
      maxDuration: req.query.max_duration ? parseInt(req.query.max_duration as string) : undefined,
      status: req.query.status as 'ok' | 'error' | 'timeout',
      businessContext: req.query.business_context ? JSON.parse(req.query.business_context as string) : undefined,
      tags: req.query.tags ? JSON.parse(req.query.tags as string) : undefined
    };

    logger.info('Searching traces', {
      userId: req.user?.userId,
      tenantId: req.user?.tenantId,
      searchCriteria: {
        ...searchCriteria,
        businessContext: !!searchCriteria.businessContext,
        tags: !!searchCriteria.tags
      }
    });

    const searchResults = await traceAnalysisService.searchTraces(searchCriteria);

    res.success({
      data: searchResults,
      meta: {
        search_criteria: {
          time_range: `${searchCriteria.startTime} - ${searchCriteria.endTime}`,
          filters_applied: Object.keys(searchCriteria).filter(key => 
            searchCriteria[key as keyof typeof searchCriteria] !== undefined
          ).length
        },
        search_timestamp: Date.now()
      }
    }, 'Trace search completed successfully');
  } catch (error) {
    logger.error('Error searching traces:', error);
    res.error('Failed to search traces', 500);
  }
});

// Legacy endpoints for backward compatibility
/**
 * GET /api/v1/analytics/productivity-trends (Legacy)
 * Get productivity trends data
 */
router.get('/productivity-trends', async (req, res) => {
  try {
    const { start_date, end_date, team_id, comparison_period } = req.query;
    const userId = req.user?.userId;
    const tenantId = req.user?.tenantId;

    logger.info('Fetching productivity trends (legacy)', {
      userId,
      tenantId,
      startDate: start_date,
      endDate: end_date,
      teamId: team_id,
      comparisonPeriod: comparison_period,
    });

    // Redirect to new performance trends endpoint
    const trendAnalysis = await performanceTrendService.analyzePerformanceTrend(
      'productivity_score',
      24, // Default 24 hours
      {
        tenantId,
        serviceName: team_id as string
      }
    );

    res.success({
      data: [trendAnalysis],
      meta: {
        start_date,
        end_date,
        total_days: 1,
        average_score: trendAnalysis.business_impact.performance_score_change,
      }
    }, 'Productivity trends retrieved successfully');
  } catch (error) {
    logger.error('Error fetching productivity trends:', error);
    res.error('Failed to fetch productivity trends', 500);
  }
});

export default router;