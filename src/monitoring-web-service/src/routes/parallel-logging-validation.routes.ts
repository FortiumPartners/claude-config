/**
 * Parallel Logging Validation API Routes
 * Task 3.3: Parallel Logging Validation Framework
 * 
 * API endpoints for managing and monitoring the parallel logging validation framework
 * including comparison results, performance metrics, test execution, and production readiness.
 */

import { Router } from 'express';
import { validationOrchestratorService } from '../services/validation-orchestrator.service';
import { logComparisonService } from '../services/log-comparison.service';
import { validationDashboardService } from '../services/validation-dashboard.service';
import { performanceAnalysisService } from '../services/performance-analysis.service';
import { loggingTestSuiteService } from '../services/logging-test-suite.service';
import { logger } from '../config/logger';

const router = Router();

/**
 * @route GET /api/v1/validation
 * @desc Get overall validation status
 */
router.get('/', async (req, res) => {
  try {
    const status = await validationOrchestratorService.getCurrentValidationStatus();
    
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('Failed to get validation status', {
      event: 'validation_api.status_failed',
      error: (error as Error).message,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve validation status',
      message: (error as Error).message,
    });
  }
});

/**
 * @route GET /api/v1/validation/report
 * @desc Get comprehensive validation report
 */
router.get('/report', async (req, res) => {
  try {
    let report;
    
    // Check if we should generate a new report or return cached
    const generateNew = req.query.generate === 'true';
    
    if (generateNew) {
      report = await validationOrchestratorService.generateValidationReport();
    } else {
      report = validationOrchestratorService.getLastValidationReport();
      if (!report) {
        report = await validationOrchestratorService.generateValidationReport();
      }
    }

    res.json({
      success: true,
      data: report,
      cached: !generateNew,
    });

  } catch (error) {
    logger.error('Failed to get validation report', {
      event: 'validation_api.report_failed',
      error: (error as Error).message,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to generate validation report',
      message: (error as Error).message,
    });
  }
});

/**
 * @route POST /api/v1/validation/comprehensive
 * @desc Run comprehensive validation suite
 */
router.post('/comprehensive', async (req, res) => {
  try {
    logger.info('Comprehensive validation requested', {
      event: 'validation_api.comprehensive_requested',
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    });

    // Start comprehensive validation (async)
    const reportPromise = validationOrchestratorService.runComprehensiveValidation();

    // Return immediately with job ID
    const jobId = `comprehensive_${Date.now()}`;
    
    res.json({
      success: true,
      message: 'Comprehensive validation started',
      jobId,
      estimatedDuration: '5-10 minutes',
    });

    // Handle completion (don't await in the response)
    reportPromise
      .then(report => {
        logger.info('Comprehensive validation completed', {
          event: 'validation_api.comprehensive_completed',
          jobId,
          status: report.summary.status,
          duration: report.duration,
        });
      })
      .catch(error => {
        logger.error('Comprehensive validation failed', {
          event: 'validation_api.comprehensive_failed',
          jobId,
          error: (error as Error).message,
        });
      });

  } catch (error) {
    logger.error('Failed to start comprehensive validation', {
      event: 'validation_api.comprehensive_start_failed',
      error: (error as Error).message,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to start comprehensive validation',
      message: (error as Error).message,
    });
  }
});

/**
 * @route GET /api/v1/validation/config
 * @desc Get validation configuration
 */
router.get('/config', (req, res) => {
  try {
    const config = validationOrchestratorService.getConfig();
    
    res.json({
      success: true,
      data: config,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get validation configuration',
      message: (error as Error).message,
    });
  }
});

/**
 * @route PUT /api/v1/validation/config
 * @desc Update validation configuration
 */
router.put('/config', (req, res) => {
  try {
    const updates = req.body;
    
    // Validate required fields
    if (updates.productionReadiness?.criteria) {
      const criteria = updates.productionReadiness.criteria;
      if (typeof criteria.minLogParity !== 'undefined' && (criteria.minLogParity < 0 || criteria.minLogParity > 100)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid configuration: minLogParity must be between 0 and 100',
        });
      }
    }

    validationOrchestratorService.updateConfig(updates);

    logger.info('Validation configuration updated', {
      event: 'validation_api.config_updated',
      updates: Object.keys(updates),
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      message: 'Configuration updated successfully',
      data: validationOrchestratorService.getConfig(),
    });

  } catch (error) {
    logger.error('Failed to update validation configuration', {
      event: 'validation_api.config_update_failed',
      error: (error as Error).message,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to update validation configuration',
      message: (error as Error).message,
    });
  }
});

// Log Comparison API endpoints
/**
 * @route GET /api/v1/validation/comparison/metrics
 * @desc Get log comparison metrics
 */
router.get('/comparison/metrics', (req, res) => {
  try {
    const metrics = logComparisonService.getMetrics();
    
    res.json({
      success: true,
      data: metrics,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get comparison metrics',
      message: (error as Error).message,
    });
  }
});

/**
 * @route GET /api/v1/validation/comparison/history
 * @desc Get log comparison history
 */
router.get('/comparison/history', (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const history = logComparisonService.getComparisonHistory(limit);
    
    res.json({
      success: true,
      data: history,
      count: history.length,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get comparison history',
      message: (error as Error).message,
    });
  }
});

/**
 * @route GET /api/v1/validation/comparison/report
 * @desc Get detailed comparison report
 */
router.get('/comparison/report', (req, res) => {
  try {
    const report = logComparisonService.generateReport();
    
    res.json({
      success: true,
      data: report,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to generate comparison report',
      message: (error as Error).message,
    });
  }
});

/**
 * @route PUT /api/v1/validation/comparison/config
 * @desc Update log comparison configuration
 */
router.put('/comparison/config', (req, res) => {
  try {
    const config = req.body;
    logComparisonService.updateConfig(config);

    logger.info('Log comparison configuration updated', {
      event: 'validation_api.comparison_config_updated',
      config,
    });

    res.json({
      success: true,
      message: 'Log comparison configuration updated',
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update comparison configuration',
      message: (error as Error).message,
    });
  }
});

// Performance Analysis API endpoints
/**
 * @route GET /api/v1/validation/performance/status
 * @desc Get performance analysis status
 */
router.get('/performance/status', (req, res) => {
  try {
    const activeBenchmarks = performanceAnalysisService.getActiveBenchmarks();
    const baseline = performanceAnalysisService.getBaselineMetrics();
    
    res.json({
      success: true,
      data: {
        activeBenchmarks: activeBenchmarks.map(b => ({
          id: b.id,
          name: b.name,
          status: b.status,
          createdAt: b.createdAt,
          completedAt: b.completedAt,
        })),
        baseline: baseline ? {
          timestamp: baseline.timestamp,
          averageLatency: baseline.metrics.averageLatency,
          memoryUsage: baseline.metrics.memoryUsageMB,
        } : null,
      },
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get performance status',
      message: (error as Error).message,
    });
  }
});

/**
 * @route POST /api/v1/validation/performance/benchmark
 * @desc Create and run performance benchmark
 */
router.post('/performance/benchmark', async (req, res) => {
  try {
    const { name, description, scenarios } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Benchmark name is required',
      });
    }

    const suiteId = await performanceAnalysisService.createBenchmarkSuite(
      name,
      description || 'API-triggered benchmark suite',
      scenarios
    );

    logger.info('Performance benchmark started via API', {
      event: 'validation_api.benchmark_started',
      suiteId,
      name,
    });

    res.json({
      success: true,
      message: 'Benchmark suite created and started',
      suiteId,
    });

  } catch (error) {
    logger.error('Failed to create benchmark suite', {
      event: 'validation_api.benchmark_create_failed',
      error: (error as Error).message,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to create benchmark suite',
      message: (error as Error).message,
    });
  }
});

/**
 * @route GET /api/v1/validation/performance/benchmark/:suiteId
 * @desc Get benchmark suite details
 */
router.get('/performance/benchmark/:suiteId', (req, res) => {
  try {
    const { suiteId } = req.params;
    const suite = performanceAnalysisService.getBenchmarkSuite(suiteId);
    
    if (!suite) {
      return res.status(404).json({
        success: false,
        error: 'Benchmark suite not found',
      });
    }

    res.json({
      success: true,
      data: suite,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get benchmark suite',
      message: (error as Error).message,
    });
  }
});

/**
 * @route POST /api/v1/validation/performance/quick-check
 * @desc Run quick performance check
 */
router.post('/performance/quick-check', async (req, res) => {
  try {
    const result = await performanceAnalysisService.runQuickPerformanceCheck();
    
    res.json({
      success: true,
      data: result,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to run quick performance check',
      message: (error as Error).message,
    });
  }
});

// Test Suite API endpoints
/**
 * @route GET /api/v1/validation/tests/scenarios
 * @desc Get all test scenarios
 */
router.get('/tests/scenarios', (req, res) => {
  try {
    const scenarios = loggingTestSuiteService.getScenarios();
    
    res.json({
      success: true,
      data: scenarios,
      count: scenarios.length,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get test scenarios',
      message: (error as Error).message,
    });
  }
});

/**
 * @route GET /api/v1/validation/tests/scenarios/:scenarioId
 * @desc Get specific test scenario
 */
router.get('/tests/scenarios/:scenarioId', (req, res) => {
  try {
    const { scenarioId } = req.params;
    const scenario = loggingTestSuiteService.getScenario(scenarioId);
    
    if (!scenario) {
      return res.status(404).json({
        success: false,
        error: 'Test scenario not found',
      });
    }

    res.json({
      success: true,
      data: scenario,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get test scenario',
      message: (error as Error).message,
    });
  }
});

/**
 * @route POST /api/v1/validation/tests/scenarios/:scenarioId/run
 * @desc Run specific test scenario
 */
router.post('/tests/scenarios/:scenarioId/run', async (req, res) => {
  try {
    const { scenarioId } = req.params;
    const scenario = loggingTestSuiteService.getScenario(scenarioId);
    
    if (!scenario) {
      return res.status(404).json({
        success: false,
        error: 'Test scenario not found',
      });
    }

    logger.info('Test scenario execution requested via API', {
      event: 'validation_api.test_scenario_run_requested',
      scenarioId,
      scenarioName: scenario.name,
    });

    // Start test execution (async)
    const testPromise = loggingTestSuiteService.runScenario(scenarioId);

    // Return immediately
    res.json({
      success: true,
      message: 'Test scenario started',
      scenarioId,
      estimatedDuration: `${scenario.timeout / 1000} seconds`,
    });

    // Handle completion (don't block response)
    testPromise
      .then(result => {
        logger.info('Test scenario completed via API', {
          event: 'validation_api.test_scenario_completed',
          scenarioId,
          status: result.status,
          duration: result.duration,
        });
      })
      .catch(error => {
        logger.error('Test scenario failed via API', {
          event: 'validation_api.test_scenario_failed',
          scenarioId,
          error: (error as Error).message,
        });
      });

  } catch (error) {
    logger.error('Failed to start test scenario', {
      event: 'validation_api.test_scenario_start_failed',
      error: (error as Error).message,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to start test scenario',
      message: (error as Error).message,
    });
  }
});

/**
 * @route POST /api/v1/validation/tests/run-all
 * @desc Run all test scenarios
 */
router.post('/tests/run-all', async (req, res) => {
  try {
    const { categories } = req.body;
    
    logger.info('All test scenarios execution requested via API', {
      event: 'validation_api.all_tests_run_requested',
      categories,
    });

    // Start all tests (async)
    const testPromise = loggingTestSuiteService.runAllScenarios(categories);

    // Return immediately
    res.json({
      success: true,
      message: 'All test scenarios started',
      categories: categories || 'all',
      estimatedDuration: '10-15 minutes',
    });

    // Handle completion
    testPromise
      .then(results => {
        logger.info('All test scenarios completed via API', {
          event: 'validation_api.all_tests_completed',
          totalTests: results.length,
          passed: results.filter(r => r.status === 'passed').length,
          failed: results.filter(r => r.status === 'failed').length,
        });
      })
      .catch(error => {
        logger.error('Test scenarios failed via API', {
          event: 'validation_api.all_tests_failed',
          error: (error as Error).message,
        });
      });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to start test scenarios',
      message: (error as Error).message,
    });
  }
});

/**
 * @route GET /api/v1/validation/tests/history
 * @desc Get test execution history
 */
router.get('/tests/history', (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const history = loggingTestSuiteService.getTestHistory(limit);
    
    res.json({
      success: true,
      data: history,
      count: history.length,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get test history',
      message: (error as Error).message,
    });
  }
});

/**
 * @route GET /api/v1/validation/tests/active
 * @desc Get currently running tests
 */
router.get('/tests/active', (req, res) => {
  try {
    const activeTests = loggingTestSuiteService.getActiveTests();
    
    res.json({
      success: true,
      data: activeTests,
      count: activeTests.length,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get active tests',
      message: (error as Error).message,
    });
  }
});

/**
 * @route GET /api/v1/validation/tests/report
 * @desc Get test suite report
 */
router.get('/tests/report', (req, res) => {
  try {
    const report = loggingTestSuiteService.generateReport();
    
    res.json({
      success: true,
      data: report,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to generate test report',
      message: (error as Error).message,
    });
  }
});

// Dashboard API endpoints
/**
 * @route GET /api/v1/validation/dashboard/metrics
 * @desc Get latest dashboard metrics
 */
router.get('/dashboard/metrics', (req, res) => {
  try {
    const metrics = validationDashboardService.getLatestMetrics();
    
    if (!metrics) {
      return res.status(404).json({
        success: false,
        error: 'No metrics available',
      });
    }

    res.json({
      success: true,
      data: metrics,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard metrics',
      message: (error as Error).message,
    });
  }
});

/**
 * @route GET /api/v1/validation/dashboard/history
 * @desc Get dashboard metrics history
 */
router.get('/dashboard/history', (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const history = validationDashboardService.getMetricsHistory(limit);
    
    res.json({
      success: true,
      data: history,
      count: history.length,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard history',
      message: (error as Error).message,
    });
  }
});

/**
 * @route GET /api/v1/validation/dashboard/alerts
 * @desc Get dashboard alerts
 */
router.get('/dashboard/alerts', (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const unacknowledgedOnly = req.query.unacknowledged === 'true';
    
    const alerts = validationDashboardService.getAlerts(limit, unacknowledgedOnly);
    
    res.json({
      success: true,
      data: alerts,
      count: alerts.length,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard alerts',
      message: (error as Error).message,
    });
  }
});

/**
 * @route POST /api/v1/validation/dashboard/alerts/:alertId/acknowledge
 * @desc Acknowledge dashboard alert
 */
router.post('/dashboard/alerts/:alertId/acknowledge', (req, res) => {
  try {
    const { alertId } = req.params;
    const acknowledged = validationDashboardService.acknowledgeAlert(alertId);
    
    if (!acknowledged) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found or already acknowledged',
      });
    }

    logger.info('Dashboard alert acknowledged via API', {
      event: 'validation_api.alert_acknowledged',
      alertId,
    });

    res.json({
      success: true,
      message: 'Alert acknowledged successfully',
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to acknowledge alert',
      message: (error as Error).message,
    });
  }
});

/**
 * @route GET /api/v1/validation/dashboard/status
 * @desc Get dashboard service status
 */
router.get('/dashboard/status', (req, res) => {
  try {
    const status = validationDashboardService.getStatus();
    
    res.json({
      success: true,
      data: status,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard status',
      message: (error as Error).message,
    });
  }
});

// Health check endpoint
/**
 * @route GET /api/v1/validation/health
 * @desc Health check for validation framework
 */
router.get('/health', async (req, res) => {
  try {
    const isReady = validationOrchestratorService.isReady();
    const status = await validationOrchestratorService.getCurrentValidationStatus();
    
    const healthStatus = {
      ready: isReady,
      status: status.overall,
      components: Object.entries(status.components).map(([name, component]) => ({
        name,
        status: component.status,
      })),
      timestamp: new Date().toISOString(),
    };

    const httpStatus = status.overall === 'critical' ? 503 : 200;
    
    res.status(httpStatus).json({
      success: true,
      data: healthStatus,
    });

  } catch (error) {
    res.status(503).json({
      success: false,
      error: 'Validation framework health check failed',
      message: (error as Error).message,
    });
  }
});

export default router;