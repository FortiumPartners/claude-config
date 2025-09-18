/**
 * Parallel Logging Validation Orchestrator
 * Task 3.3: Parallel Logging Validation Framework
 * 
 * Main orchestrator service that coordinates log comparison, dashboard monitoring,
 * performance analysis, and automated testing for comprehensive validation.
 */

import { EventEmitter } from 'events';
import { logger } from '../config/logger';
import { logComparisonService, LogComparisonService } from './log-comparison.service';
import { validationDashboardService, ValidationDashboardService } from './validation-dashboard.service';
import { performanceAnalysisService, PerformanceAnalysisService } from './performance-analysis.service';
import { loggingTestSuiteService, LoggingTestSuiteService } from './logging-test-suite.service';

// Validation framework types
export interface ValidationConfig {
  enabled: boolean;
  components: {
    logComparison: boolean;
    dashboard: boolean;
    performanceAnalysis: boolean;
    testSuite: boolean;
  };
  automatedTesting: {
    enabled: boolean;
    schedule: 'continuous' | 'hourly' | 'daily' | 'weekly' | 'manual';
    scenarios: string[];
    failureThreshold: number; // percentage of failed tests to trigger alert
  };
  productionReadiness: {
    enabled: boolean;
    criteria: {
      minLogParity: number; // percentage
      maxLatencyImpact: number; // milliseconds
      maxMemoryIncrease: number; // MB
      minSuccessRate: number; // percentage
    };
    approvalWorkflow: boolean;
  };
  integration: {
    alerting: {
      webhookUrl?: string;
      emailNotifications?: boolean;
    };
    cicd: {
      enabled: boolean;
      failOnCritical: boolean;
      reportPath?: string;
    };
  };
}

export interface ValidationStatus {
  overall: 'healthy' | 'warning' | 'critical' | 'disabled';
  timestamp: string;
  components: {
    logComparison: {
      status: 'healthy' | 'warning' | 'critical' | 'disabled';
      metrics: any;
      lastUpdate: string;
    };
    dashboard: {
      status: 'healthy' | 'warning' | 'critical' | 'disabled';
      connectedClients: number;
      lastUpdate: string;
    };
    performanceAnalysis: {
      status: 'healthy' | 'warning' | 'critical' | 'disabled';
      activeBenchmarks: number;
      lastBaseline: string | null;
    };
    testSuite: {
      status: 'healthy' | 'warning' | 'critical' | 'disabled';
      activeTests: number;
      lastTestRun: string | null;
      successRate: number;
    };
  };
  productionReadiness: {
    approved: boolean;
    score: number; // 0-100
    blockers: string[];
    recommendations: string[];
  };
}

export interface ValidationReport {
  id: string;
  timestamp: string;
  duration: number; // seconds
  summary: {
    status: 'passed' | 'failed' | 'warning';
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
    criticalIssues: number;
  };
  logComparison: {
    totalComparisons: number;
    successfulMatches: number;
    averageScore: number;
    topIssues: Array<{ field: string; count: number; severity: string }>;
  };
  performance: {
    latencyImpact: number; // percentage
    memoryImpact: number; // percentage
    throughputImpact: number; // percentage
    benchmark: string | null;
  };
  testing: {
    scenariosRun: number;
    passed: number;
    failed: number;
    categories: Record<string, { passed: number; failed: number }>;
  };
  recommendations: string[];
  productionReadiness: {
    approved: boolean;
    concerns: string[];
    conditions: string[];
  };
}

/**
 * Parallel Logging Validation Orchestrator Service
 */
export class ValidationOrchestratorService extends EventEmitter {
  private config: ValidationConfig;
  private isInitialized: boolean = false;
  private automatedTestingInterval: NodeJS.Timeout | null = null;
  private statusUpdateInterval: NodeJS.Timeout | null = null;
  private lastValidationReport: ValidationReport | null = null;

  constructor(config?: Partial<ValidationConfig>) {
    super();

    this.config = {
      enabled: true,
      components: {
        logComparison: true,
        dashboard: true,
        performanceAnalysis: true,
        testSuite: true,
      },
      automatedTesting: {
        enabled: true,
        schedule: 'hourly',
        scenarios: [
          'basic_parallel_logging',
          'high_volume_parallel_logging',
          'seq_transport_failure',
          'data_integrity_validation',
        ],
        failureThreshold: 20, // 20% failure rate triggers alert
      },
      productionReadiness: {
        enabled: true,
        criteria: {
          minLogParity: 95, // 95% of logs must match
          maxLatencyImpact: 5, // <5ms additional latency
          maxMemoryIncrease: 50, // <50MB memory increase
          minSuccessRate: 99, // 99% success rate
        },
        approvalWorkflow: true,
      },
      integration: {
        alerting: {
          emailNotifications: true,
        },
        cicd: {
          enabled: false,
          failOnCritical: true,
        },
      },
      ...config,
    };

    this.initialize();
  }

  private async initialize(): Promise<void> {
    if (!this.config.enabled) {
      logger.info('Validation Orchestrator disabled via configuration');
      return;
    }

    try {
      // Initialize component services
      await this.initializeComponents();

      // Set up event listeners
      this.setupEventListeners();

      // Start automated processes
      await this.startAutomatedProcesses();

      this.isInitialized = true;

      logger.info('Validation Orchestrator initialized', {
        event: 'validation_orchestrator.initialized',
        config: this.config,
        components: Object.keys(this.config.components).filter(key => (this.config.components as any)[key]),
      });

    } catch (error) {
      logger.error('Failed to initialize Validation Orchestrator', {
        event: 'validation_orchestrator.initialization_failed',
        error: (error as Error).message,
      });
      throw error;
    }
  }

  private async initializeComponents(): Promise<void> {
    const initPromises: Promise<void>[] = [];

    // Initialize enabled components
    if (this.config.components.logComparison) {
      initPromises.push(this.initializeLogComparison());
    }

    if (this.config.components.dashboard) {
      initPromises.push(this.initializeDashboard());
    }

    if (this.config.components.performanceAnalysis) {
      initPromises.push(this.initializePerformanceAnalysis());
    }

    if (this.config.components.testSuite) {
      initPromises.push(this.initializeTestSuite());
    }

    await Promise.all(initPromises);
  }

  private async initializeLogComparison(): Promise<void> {
    // Configure log comparison service for validation
    logComparisonService.updateConfig({
      enabled: true,
      correlationWindow: 10000, // 10 seconds
      autoAlert: {
        enabled: true,
        scoreThreshold: 85,
        criticalDifferenceThreshold: 3,
      },
    });

    logger.debug('Log comparison service configured for validation', {
      event: 'validation_orchestrator.log_comparison_initialized',
    });
  }

  private async initializeDashboard(): Promise<void> {
    // Dashboard should already be initialized by its singleton
    // Configure specific alert rules for validation
    const dashboardConfig = {
      alerting: {
        enabled: true,
        rules: [
          {
            id: 'validation_low_parity',
            name: 'Validation: Low Log Parity',
            enabled: true,
            condition: {
              metric: 'realTimeStats.matchRate',
              operator: '<' as const,
              threshold: this.config.productionReadiness.criteria.minLogParity,
              duration: 60,
            },
            severity: 'high' as const,
            message: 'Log parity has dropped below production readiness threshold',
            cooldown: 300,
          },
          {
            id: 'validation_high_latency',
            name: 'Validation: High Latency Impact',
            enabled: true,
            condition: {
              metric: 'performanceImpact.additionalLatencyMs',
              operator: '>' as const,
              threshold: this.config.productionReadiness.criteria.maxLatencyImpact,
              duration: 120,
            },
            severity: 'high' as const,
            message: 'Latency impact exceeds production readiness threshold',
            cooldown: 600,
          },
        ],
      },
    };

    validationDashboardService.updateConfig(dashboardConfig);

    logger.debug('Dashboard service configured for validation', {
      event: 'validation_orchestrator.dashboard_initialized',
    });
  }

  private async initializePerformanceAnalysis(): Promise<void> {
    // Start continuous monitoring
    performanceAnalysisService.startContinuousMonitoring();

    // Configure regression thresholds based on production readiness criteria
    performanceAnalysisService.updateConfig({
      regressionThresholds: {
        latency: (this.config.productionReadiness.criteria.maxLatencyImpact / 10) * 100, // Convert to percentage
        throughput: 5,
        memory: (this.config.productionReadiness.criteria.maxMemoryIncrease / 100) * 100,
        cpu: 15,
      },
    });

    logger.debug('Performance analysis service configured for validation', {
      event: 'validation_orchestrator.performance_analysis_initialized',
    });
  }

  private async initializeTestSuite(): Promise<void> {
    // Configure test suite for automated validation
    loggingTestSuiteService.updateConfig({
      enabled: true,
      continualTesting: {
        enabled: this.config.automatedTesting.enabled,
        interval: this.getTestingIntervalMinutes(),
        scenarios: this.config.automatedTesting.scenarios,
      },
    });

    logger.debug('Test suite service configured for validation', {
      event: 'validation_orchestrator.test_suite_initialized',
    });
  }

  private getTestingIntervalMinutes(): number {
    switch (this.config.automatedTesting.schedule) {
      case 'continuous':
        return 15; // Every 15 minutes
      case 'hourly':
        return 60;
      case 'daily':
        return 24 * 60;
      case 'weekly':
        return 7 * 24 * 60;
      default:
        return 60;
    }
  }

  private setupEventListeners(): void {
    // Log comparison events
    if (this.config.components.logComparison) {
      logComparisonService.on('comparison_mismatch', (result) => {
        this.handleComparisonMismatch(result);
      });

      logComparisonService.on('comparison_alert', (result) => {
        this.handleComparisonAlert(result);
      });
    }

    // Dashboard events
    if (this.config.components.dashboard) {
      validationDashboardService.on('alert_triggered', (alert) => {
        this.handleDashboardAlert(alert);
      });
    }

    // Performance analysis events
    if (this.config.components.performanceAnalysis) {
      performanceAnalysisService.on('regression_detected', (alert) => {
        this.handlePerformanceRegression(alert);
      });

      performanceAnalysisService.on('benchmark_completed', (suite) => {
        this.handleBenchmarkCompleted(suite);
      });
    }

    // Test suite events
    if (this.config.components.testSuite) {
      loggingTestSuiteService.on('scenario_completed', (result) => {
        this.handleTestScenarioCompleted(result);
      });

      loggingTestSuiteService.on('continual_testing_failures', (failures) => {
        this.handleContinualTestingFailures(failures);
      });
    }

    logger.debug('Event listeners configured', {
      event: 'validation_orchestrator.event_listeners_setup',
    });
  }

  private async startAutomatedProcesses(): Promise<void> {
    // Start status monitoring
    this.statusUpdateInterval = setInterval(() => {
      this.updateValidationStatus();
    }, 30000); // Every 30 seconds

    // Initial status update
    await this.updateValidationStatus();

    logger.debug('Automated processes started', {
      event: 'validation_orchestrator.automated_processes_started',
    });
  }

  // Event handlers
  private handleComparisonMismatch(result: any): void {
    logger.warn('Log comparison mismatch detected', {
      event: 'validation_orchestrator.comparison_mismatch',
      correlationId: result.correlationId,
      score: result.score,
      criticalDifferences: result.differences.filter((d: any) => d.severity === 'critical').length,
    });

    this.emit('validation_issue', {
      type: 'comparison_mismatch',
      severity: result.score < 50 ? 'critical' : 'warning',
      data: result,
    });
  }

  private handleComparisonAlert(result: any): void {
    logger.error('Critical log comparison alert', {
      event: 'validation_orchestrator.comparison_alert',
      correlationId: result.correlationId,
      score: result.score,
    });

    this.emit('validation_alert', {
      type: 'comparison_critical',
      severity: 'critical',
      data: result,
    });
  }

  private handleDashboardAlert(alert: any): void {
    logger.warn('Dashboard alert triggered', {
      event: 'validation_orchestrator.dashboard_alert',
      alertId: alert.id,
      severity: alert.severity,
      type: alert.type,
    });

    this.emit('validation_alert', {
      type: 'dashboard_alert',
      severity: alert.severity,
      data: alert,
    });
  }

  private handlePerformanceRegression(alert: any): void {
    logger.error('Performance regression detected', {
      event: 'validation_orchestrator.performance_regression',
      metric: alert.metric,
      changePercent: alert.changePercent,
      threshold: alert.threshold,
    });

    this.emit('validation_alert', {
      type: 'performance_regression',
      severity: alert.severity,
      data: alert,
    });
  }

  private handleBenchmarkCompleted(suite: any): void {
    logger.info('Benchmark suite completed', {
      event: 'validation_orchestrator.benchmark_completed',
      suiteId: suite.id,
      status: suite.status,
      recommendations: suite.summary?.recommendations?.length || 0,
    });

    // Check if benchmark results affect production readiness
    if (suite.summary?.productionReadiness) {
      this.emit('production_readiness_update', {
        approved: suite.summary.productionReadiness.approved,
        concerns: suite.summary.productionReadiness.concerns,
        conditions: suite.summary.productionReadiness.conditions,
      });
    }
  }

  private handleTestScenarioCompleted(result: any): void {
    if (result.status === 'failed' || result.status === 'error') {
      logger.warn('Test scenario failed', {
        event: 'validation_orchestrator.test_scenario_failed',
        scenarioId: result.scenarioId,
        testRunId: result.testRunId,
        status: result.status,
        errors: result.errors.length,
      });

      this.emit('validation_issue', {
        type: 'test_failure',
        severity: result.errors.filter((e: any) => !e.recovered).length > 0 ? 'critical' : 'warning',
        data: result,
      });
    }
  }

  private handleContinualTestingFailures(failures: any[]): void {
    const failureRate = (failures.length / this.config.automatedTesting.scenarios.length) * 100;
    
    if (failureRate >= this.config.automatedTesting.failureThreshold) {
      logger.error('High test failure rate detected', {
        event: 'validation_orchestrator.high_test_failure_rate',
        failureCount: failures.length,
        totalScenarios: this.config.automatedTesting.scenarios.length,
        failureRate,
        threshold: this.config.automatedTesting.failureThreshold,
      });

      this.emit('validation_alert', {
        type: 'high_test_failure_rate',
        severity: 'critical',
        data: { failures, failureRate },
      });
    }
  }

  private async updateValidationStatus(): Promise<void> {
    try {
      const status = await this.getCurrentValidationStatus();
      
      // Check for critical issues
      const criticalComponents = Object.values(status.components)
        .filter(component => component.status === 'critical').length;

      if (criticalComponents > 0) {
        this.emit('validation_status_critical', status);
      }

      this.emit('validation_status_updated', status);

    } catch (error) {
      logger.error('Failed to update validation status', {
        event: 'validation_orchestrator.status_update_failed',
        error: (error as Error).message,
      });
    }
  }

  // Public API methods
  async getCurrentValidationStatus(): Promise<ValidationStatus> {
    const timestamp = new Date().toISOString();
    
    // Get component statuses
    const logComparisonMetrics = logComparisonService.getMetrics();
    const dashboardStatus = validationDashboardService.getStatus();
    const performanceBenchmarks = performanceAnalysisService.getActiveBenchmarks();
    const performanceBaseline = performanceAnalysisService.getBaselineMetrics();
    const testHistory = loggingTestSuiteService.getTestHistory(10);
    const activeTests = loggingTestSuiteService.getActiveTests();

    // Calculate component statuses
    const logComparisonStatus = this.determineLogComparisonStatus(logComparisonMetrics);
    const dashboardComponentStatus = this.determineDashboardStatus(dashboardStatus);
    const performanceStatus = this.determinePerformanceStatus(performanceBenchmarks, performanceBaseline);
    const testSuiteStatus = this.determineTestSuiteStatus(testHistory, activeTests);

    // Calculate overall status
    const componentStatuses = [logComparisonStatus, dashboardComponentStatus, performanceStatus, testSuiteStatus];
    const overallStatus = this.determineOverallStatus(componentStatuses);

    // Calculate production readiness
    const productionReadiness = await this.assessProductionReadiness();

    const status: ValidationStatus = {
      overall: overallStatus,
      timestamp,
      components: {
        logComparison: {
          status: logComparisonStatus,
          metrics: logComparisonMetrics,
          lastUpdate: logComparisonMetrics.lastComparison,
        },
        dashboard: {
          status: dashboardComponentStatus,
          connectedClients: dashboardStatus.connectedClients,
          lastUpdate: timestamp,
        },
        performanceAnalysis: {
          status: performanceStatus,
          activeBenchmarks: performanceBenchmarks.length,
          lastBaseline: performanceBaseline?.timestamp || null,
        },
        testSuite: {
          status: testSuiteStatus,
          activeTests: activeTests.length,
          lastTestRun: testHistory[0]?.startTime || null,
          successRate: testHistory.length > 0 
            ? (testHistory.filter(t => t.status === 'passed').length / testHistory.length) * 100 
            : 0,
        },
      },
      productionReadiness,
    };

    return status;
  }

  private determineLogComparisonStatus(metrics: any): 'healthy' | 'warning' | 'critical' | 'disabled' {
    if (!this.config.components.logComparison) return 'disabled';
    
    if (metrics.averageScore < 70) return 'critical';
    if (metrics.averageScore < 85) return 'warning';
    if (metrics.totalComparisons === 0) return 'warning';
    
    return 'healthy';
  }

  private determineDashboardStatus(status: any): 'healthy' | 'warning' | 'critical' | 'disabled' {
    if (!this.config.components.dashboard) return 'disabled';
    
    if (status.unacknowledgedAlerts > 10) return 'critical';
    if (status.unacknowledgedAlerts > 5) return 'warning';
    
    return 'healthy';
  }

  private determinePerformanceStatus(benchmarks: any[], baseline: any): 'healthy' | 'warning' | 'critical' | 'disabled' {
    if (!this.config.components.performanceAnalysis) return 'disabled';
    
    if (!baseline) return 'warning';
    if (benchmarks.some(b => b.status === 'failed')) return 'critical';
    
    return 'healthy';
  }

  private determineTestSuiteStatus(history: any[], activeTests: any[]): 'healthy' | 'warning' | 'critical' | 'disabled' {
    if (!this.config.components.testSuite) return 'disabled';
    
    if (history.length === 0) return 'warning';
    
    const recentFailures = history.slice(0, 5).filter(t => t.status === 'failed' || t.status === 'error');
    if (recentFailures.length > 2) return 'critical';
    if (recentFailures.length > 0) return 'warning';
    
    return 'healthy';
  }

  private determineOverallStatus(componentStatuses: string[]): 'healthy' | 'warning' | 'critical' | 'disabled' {
    if (componentStatuses.includes('critical')) return 'critical';
    if (componentStatuses.includes('warning')) return 'warning';
    if (componentStatuses.every(s => s === 'disabled')) return 'disabled';
    
    return 'healthy';
  }

  private async assessProductionReadiness(): Promise<ValidationStatus['productionReadiness']> {
    if (!this.config.productionReadiness.enabled) {
      return {
        approved: false,
        score: 0,
        blockers: ['Production readiness assessment disabled'],
        recommendations: ['Enable production readiness assessment'],
      };
    }

    const blockers: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

    // Check log parity
    const comparisonMetrics = logComparisonService.getMetrics();
    const logParity = comparisonMetrics.totalComparisons > 0
      ? (comparisonMetrics.successfulMatches / comparisonMetrics.totalComparisons) * 100
      : 0;

    if (logParity < this.config.productionReadiness.criteria.minLogParity) {
      blockers.push(`Log parity (${logParity.toFixed(1)}%) below minimum (${this.config.productionReadiness.criteria.minLogParity}%)`);
      score -= 20;
    }

    // Check performance impact
    const dashboardMetrics = validationDashboardService.getLatestMetrics();
    if (dashboardMetrics?.performanceImpact.additionalLatencyMs > this.config.productionReadiness.criteria.maxLatencyImpact) {
      blockers.push(`Latency impact (${dashboardMetrics.performanceImpact.additionalLatencyMs}ms) exceeds maximum (${this.config.productionReadiness.criteria.maxLatencyImpact}ms)`);
      score -= 25;
    }

    if (dashboardMetrics?.performanceImpact.memoryUsageMB > this.config.productionReadiness.criteria.maxMemoryIncrease) {
      blockers.push(`Memory increase (${dashboardMetrics.performanceImpact.memoryUsageMB}MB) exceeds maximum (${this.config.productionReadiness.criteria.maxMemoryIncrease}MB)`);
      score -= 15;
    }

    // Check test success rate
    const testHistory = loggingTestSuiteService.getTestHistory(20);
    const successRate = testHistory.length > 0 
      ? (testHistory.filter(t => t.status === 'passed').length / testHistory.length) * 100 
      : 0;

    if (successRate < this.config.productionReadiness.criteria.minSuccessRate) {
      blockers.push(`Test success rate (${successRate.toFixed(1)}%) below minimum (${this.config.productionReadiness.criteria.minSuccessRate}%)`);
      score -= 30;
    }

    // Generate recommendations
    if (blockers.length === 0) {
      recommendations.push('All production readiness criteria met');
      recommendations.push('Consider gradual rollout with monitoring');
    } else {
      recommendations.push('Address blocking issues before production deployment');
      recommendations.push('Continue validation testing until criteria are met');
    }

    const approved = blockers.length === 0 && score >= 80;

    return {
      approved,
      score: Math.max(0, score),
      blockers,
      recommendations,
    };
  }

  async generateValidationReport(): Promise<ValidationReport> {
    const reportId = `validation_report_${Date.now()}`;
    const startTime = Date.now();

    try {
      logger.info('Generating comprehensive validation report', {
        event: 'validation_orchestrator.report_generation_started',
        reportId,
      });

      // Collect data from all components
      const comparisonReport = logComparisonService.generateReport();
      const performanceAnalysis = await performanceAnalysisService.runQuickPerformanceCheck();
      const testSuiteReport = loggingTestSuiteService.generateReport();
      const productionReadiness = await this.assessProductionReadiness();

      // Calculate summary
      const totalChecks = 
        (comparisonReport.summary.totalComparisons > 0 ? 1 : 0) +
        1 + // Performance check
        testSuiteReport.summary.recentTests;

      const passedChecks = 
        (comparisonReport.summary.averageScore > 80 ? 1 : 0) +
        (performanceAnalysis.latencyImpact < 10 ? 1 : 0) +
        testSuiteReport.summary.recentTests * (testSuiteReport.summary.successRate / 100);

      const failedChecks = totalChecks - passedChecks;
      const criticalIssues = comparisonReport.topIssues.filter(issue => issue.severity === 'critical').length;

      const status = criticalIssues > 0 ? 'failed' : 
                    failedChecks > totalChecks * 0.2 ? 'warning' : 'passed';

      // Compile recommendations
      const recommendations = [
        ...comparisonReport.recommendations,
        ...testSuiteReport.recommendations,
        ...productionReadiness.recommendations,
      ].slice(0, 10); // Top 10 recommendations

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      const report: ValidationReport = {
        id: reportId,
        timestamp: new Date().toISOString(),
        duration,
        summary: {
          status,
          totalChecks,
          passedChecks: Math.floor(passedChecks),
          failedChecks: Math.ceil(failedChecks),
          criticalIssues,
        },
        logComparison: {
          totalComparisons: comparisonReport.summary.totalComparisons,
          successfulMatches: comparisonReport.summary.successfulMatches,
          averageScore: comparisonReport.summary.averageScore,
          topIssues: comparisonReport.topIssues,
        },
        performance: {
          latencyImpact: performanceAnalysis.latencyImpact,
          memoryImpact: performanceAnalysis.resourceImpact,
          throughputImpact: 0, // Would need additional metrics
          benchmark: null, // Would reference specific benchmark
        },
        testing: {
          scenariosRun: testSuiteReport.summary.recentTests,
          passed: Math.floor(testSuiteReport.summary.recentTests * (testSuiteReport.summary.successRate / 100)),
          failed: testSuiteReport.summary.recentTests - Math.floor(testSuiteReport.summary.recentTests * (testSuiteReport.summary.successRate / 100)),
          categories: testSuiteReport.categoryBreakdown,
        },
        recommendations,
        productionReadiness: {
          approved: productionReadiness.approved,
          concerns: productionReadiness.blockers,
          conditions: productionReadiness.recommendations,
        },
      };

      this.lastValidationReport = report;

      logger.info('Validation report generated', {
        event: 'validation_orchestrator.report_generated',
        reportId,
        duration,
        status: report.summary.status,
        totalChecks: report.summary.totalChecks,
        productionReady: report.productionReadiness.approved,
      });

      this.emit('validation_report_generated', report);

      return report;

    } catch (error) {
      logger.error('Failed to generate validation report', {
        event: 'validation_orchestrator.report_generation_failed',
        reportId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async runComprehensiveValidation(): Promise<ValidationReport> {
    logger.info('Starting comprehensive validation run', {
      event: 'validation_orchestrator.comprehensive_validation_started',
    });

    try {
      // Run test scenarios
      if (this.config.components.testSuite) {
        await loggingTestSuiteService.runAllScenarios(['functional', 'performance', 'failure']);
      }

      // Run performance benchmark
      if (this.config.components.performanceAnalysis) {
        await performanceAnalysisService.createBenchmarkSuite(
          'Comprehensive Validation Benchmark',
          'Full performance validation for production readiness'
        );
      }

      // Wait for results to propagate
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Generate comprehensive report
      const report = await this.generateValidationReport();

      this.emit('comprehensive_validation_completed', report);

      return report;

    } catch (error) {
      logger.error('Comprehensive validation failed', {
        event: 'validation_orchestrator.comprehensive_validation_failed',
        error: (error as Error).message,
      });
      throw error;
    }
  }

  getLastValidationReport(): ValidationReport | null {
    return this.lastValidationReport;
  }

  updateConfig(newConfig: Partial<ValidationConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };

    // Update component configurations
    if (this.config.components.testSuite !== oldConfig.components.testSuite) {
      if (this.config.components.testSuite) {
        this.initializeTestSuite();
      }
    }

    // Restart automated testing if schedule changed
    if (this.config.automatedTesting.schedule !== oldConfig.automatedTesting.schedule) {
      if (this.config.components.testSuite) {
        loggingTestSuiteService.updateConfig({
          continualTesting: {
            enabled: this.config.automatedTesting.enabled,
            interval: this.getTestingIntervalMinutes(),
            scenarios: this.config.automatedTesting.scenarios,
          },
        });
      }
    }

    logger.info('Validation orchestrator configuration updated', {
      event: 'validation_orchestrator.config_updated',
      changes: {
        automatedTesting: {
          schedule: {
            old: oldConfig.automatedTesting.schedule,
            new: this.config.automatedTesting.schedule,
          },
        },
      },
    });
  }

  getConfig(): ValidationConfig {
    return { ...this.config };
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  destroy(): void {
    // Stop automated processes
    if (this.statusUpdateInterval) {
      clearInterval(this.statusUpdateInterval);
      this.statusUpdateInterval = null;
    }

    if (this.automatedTestingInterval) {
      clearInterval(this.automatedTestingInterval);
      this.automatedTestingInterval = null;
    }

    // Stop component monitoring
    if (this.config.components.performanceAnalysis) {
      performanceAnalysisService.stopContinuousMonitoring();
    }

    this.removeAllListeners();
    this.isInitialized = false;

    logger.info('Validation Orchestrator destroyed', {
      event: 'validation_orchestrator.destroyed',
    });
  }
}

// Export singleton instance
export const validationOrchestratorService = new ValidationOrchestratorService();

export default ValidationOrchestratorService;