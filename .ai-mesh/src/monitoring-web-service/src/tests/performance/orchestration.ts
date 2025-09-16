/**
 * Performance Test Orchestration Script
 * Task 1.3: Performance test orchestration for Seq to OpenTelemetry migration
 * 
 * Orchestrates comprehensive performance testing including baseline establishment,
 * load testing, regression detection, and monitoring during migration phases.
 */

import { SeqLoggingBaselineBenchmark, BaselineMetrics, PERFORMANCE_TARGETS } from './logging-baseline.benchmark';
import { LoadTestingFramework, LoadTestMetrics } from './load-testing-framework';
import { PerformanceMonitoringDashboard } from './monitoring-dashboard';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { performance } from 'perf_hooks';

// Test orchestration configuration
interface OrchestrationConfig {
  outputDir: string;
  runBaseline: boolean;
  runLoadTests: boolean;
  runMonitoring: boolean;
  monitoringDuration: number; // seconds
  regressionThreshold: number; // percentage
  enableReporting: boolean;
  enableAlerts: boolean;
  skipCleanup: boolean;
}

interface TestResults {
  orchestrationId: string;
  timestamp: string;
  duration: number;
  baseline?: BaselineMetrics;
  loadTests?: Record<string, LoadTestMetrics>;
  monitoring?: {
    duration: number;
    snapshots: number;
    alerts: number;
    reportPath: string;
  };
  regressionAnalysis?: {
    hasRegressions: boolean;
    regressions: string[];
    improvements: string[];
    overallScore: number;
  };
  success: boolean;
  errors: string[];
}

class PerformanceTestOrchestrator {
  private config: OrchestrationConfig;
  private results: TestResults;
  private baseline: SeqLoggingBaselineBenchmark | null = null;
  private loadTesting: LoadTestingFramework | null = null;
  private monitoring: PerformanceMonitoringDashboard | null = null;
  private startTime: number = 0;

  constructor(config: Partial<OrchestrationConfig> = {}) {
    this.config = {
      outputDir: path.join(__dirname, '../../..', 'test-results', `perf-${Date.now()}`),
      runBaseline: true,
      runLoadTests: true,
      runMonitoring: false, // Disabled by default for CI/CD
      monitoringDuration: 300, // 5 minutes
      regressionThreshold: 15, // 15% regression threshold
      enableReporting: true,
      enableAlerts: true,
      skipCleanup: false,
      ...config
    };

    this.results = {
      orchestrationId: `perf-test-${Date.now()}`,
      timestamp: new Date().toISOString(),
      duration: 0,
      success: false,
      errors: []
    };
  }

  async execute(): Promise<TestResults> {
    console.log('🎯 Starting Performance Test Orchestration');
    console.log(`📋 Test ID: ${this.results.orchestrationId}`);
    console.log(`📁 Output Directory: ${this.config.outputDir}`);
    
    this.startTime = performance.now();

    try {
      // Create output directory
      await fs.mkdir(this.config.outputDir, { recursive: true });

      // Phase 1: Baseline Performance Testing
      if (this.config.runBaseline) {
        await this.runBaselineTests();
      }

      // Phase 2: Load Testing
      if (this.config.runLoadTests) {
        await this.runLoadTests();
      }

      // Phase 3: Monitoring (if enabled)
      if (this.config.runMonitoring) {
        await this.runMonitoring();
      }

      // Phase 4: Regression Analysis
      await this.performRegressionAnalysis();

      // Phase 5: Generate Reports
      if (this.config.enableReporting) {
        await this.generateReports();
      }

      this.results.success = this.results.errors.length === 0 && 
                           (!this.results.regressionAnalysis?.hasRegressions || false);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Orchestration failed:', errorMsg);
      this.results.errors.push(errorMsg);
      this.results.success = false;
    } finally {
      this.results.duration = (performance.now() - this.startTime) / 1000;
      await this.cleanup();
    }

    return this.results;
  }

  private async runBaselineTests(): Promise<void> {
    console.log('\n📊 Phase 1: Running Baseline Performance Tests');
    
    try {
      this.baseline = new SeqLoggingBaselineBenchmark();
      await this.baseline.initialize();
      
      console.log('🔍 Executing baseline benchmark...');
      const baselineMetrics = await this.baseline.runBaselineTests();
      
      console.log('🏃 Running load test scenarios...');
      const loadTestResults = await this.baseline.runLoadTestScenarios();
      
      this.results.baseline = baselineMetrics;
      
      // Save baseline results
      const baselineReport = this.baseline.generateBaselineReport(baselineMetrics);
      const baselinePath = path.join(this.config.outputDir, 'baseline-report.md');
      await fs.writeFile(baselinePath, baselineReport, 'utf8');
      
      const baselineDataPath = path.join(this.config.outputDir, 'baseline-metrics.json');
      await fs.writeFile(baselineDataPath, JSON.stringify({
        metrics: baselineMetrics,
        loadTests: loadTestResults,
        timestamp: new Date().toISOString()
      }, null, 2), 'utf8');
      
      // Validate against targets
      const meetsTargets = this.validateBaselineTargets(baselineMetrics);
      if (!meetsTargets) {
        this.results.errors.push('Baseline metrics do not meet performance targets');
      }
      
      console.log('✅ Baseline testing completed');
      console.log(`   Report saved to: ${baselinePath}`);
      
    } catch (error) {
      const errorMsg = `Baseline testing failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error('❌', errorMsg);
      this.results.errors.push(errorMsg);
    }
  }

  private async runLoadTests(): Promise<void> {
    console.log('\n🔥 Phase 2: Running Load Tests');
    
    try {
      this.loadTesting = new LoadTestingFramework();
      await this.loadTesting.initialize();
      
      console.log('🚀 Executing comprehensive load test suite...');
      const loadTestResults = await this.loadTesting.runAllLoadTests();
      
      this.results.loadTests = loadTestResults;
      
      // Generate load test report
      const loadTestReport = this.loadTesting.generateLoadTestReport(loadTestResults);
      const loadTestPath = path.join(this.config.outputDir, 'load-test-report.md');
      await fs.writeFile(loadTestPath, loadTestReport, 'utf8');
      
      const loadTestDataPath = path.join(this.config.outputDir, 'load-test-results.json');
      await fs.writeFile(loadTestDataPath, JSON.stringify({
        results: loadTestResults,
        timestamp: new Date().toISOString()
      }, null, 2), 'utf8');
      
      // Validate load test results
      const hasFailures = this.validateLoadTestResults(loadTestResults);
      if (hasFailures) {
        this.results.errors.push('Load tests show performance issues');
      }
      
      console.log('✅ Load testing completed');
      console.log(`   Report saved to: ${loadTestPath}`);
      
    } catch (error) {
      const errorMsg = `Load testing failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error('❌', errorMsg);
      this.results.errors.push(errorMsg);
    }
  }

  private async runMonitoring(): Promise<void> {
    console.log('\n📈 Phase 3: Running Performance Monitoring');
    
    try {
      this.monitoring = new PerformanceMonitoringDashboard({
        refreshInterval: 1000,
        retentionPeriod: this.config.monitoringDuration * 1000
      });
      
      await this.monitoring.initialize();
      console.log(`🎯 Monitoring for ${this.config.monitoringDuration} seconds...`);
      
      let alertCount = 0;
      this.monitoring.on('alert', (alert) => {
        console.log(`🚨 Alert: ${alert.name} (${alert.severity})`);
        alertCount++;
      });
      
      // Monitor for specified duration
      await new Promise(resolve => {
        setTimeout(resolve, this.config.monitoringDuration * 1000);
      });
      
      // Generate monitoring report
      const monitoringReport = await this.monitoring.generateReport();
      const monitoringPath = path.join(this.config.outputDir, 'monitoring-report.md');
      await fs.writeFile(monitoringPath, monitoringReport, 'utf8');
      
      this.results.monitoring = {
        duration: this.config.monitoringDuration,
        snapshots: 0, // Would be populated from actual monitoring
        alerts: alertCount,
        reportPath: monitoringPath
      };
      
      console.log('✅ Performance monitoring completed');
      console.log(`   ${alertCount} alerts triggered`);
      
    } catch (error) {
      const errorMsg = `Monitoring failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error('❌', errorMsg);
      this.results.errors.push(errorMsg);
    }
  }

  private async performRegressionAnalysis(): Promise<void> {
    console.log('\n🔍 Phase 4: Regression Analysis');
    
    try {
      // Load previous baseline if available
      const previousBaselinePath = this.findPreviousBaseline();
      
      if (!previousBaselinePath) {
        console.log('ℹ️  No previous baseline found - skipping regression analysis');
        return;
      }
      
      if (!this.results.baseline) {
        console.log('⚠️  Current baseline not available - skipping regression analysis');
        return;
      }
      
      console.log(`📋 Comparing against previous baseline: ${previousBaselinePath}`);
      
      const previousData = JSON.parse(await fs.readFile(previousBaselinePath, 'utf8'));
      const previousBaseline = previousData.metrics || previousData.baseline;
      
      if (!previousBaseline) {
        console.log('⚠️  Previous baseline format invalid - skipping regression analysis');
        return;
      }
      
      // Perform regression analysis
      const regressions: string[] = [];
      const improvements: string[] = [];
      let score = 100; // Start with perfect score
      
      // Analyze latency regression
      const latencyIncrease = ((this.results.baseline.endToEnd.loggingOverheadMs - previousBaseline.endToEnd.loggingOverheadMs) / previousBaseline.endToEnd.loggingOverheadMs) * 100;
      if (latencyIncrease > this.config.regressionThreshold) {
        regressions.push(`Logging latency increased by ${latencyIncrease.toFixed(1)}%`);
        score -= 20;
      } else if (latencyIncrease < -5) {
        improvements.push(`Logging latency improved by ${Math.abs(latencyIncrease).toFixed(1)}%`);
        score += 5;
      }
      
      // Analyze memory regression
      const memoryIncrease = this.results.baseline.system.memoryGrowthMb - previousBaseline.system.memoryGrowthMb;
      if (memoryIncrease > 50) { // 50MB threshold
        regressions.push(`Memory usage increased by ${memoryIncrease.toFixed(1)}MB`);
        score -= 15;
      }
      
      // Analyze throughput regression
      const throughputChange = ((this.results.baseline.logging.throughputLogsPerSecond - previousBaseline.logging.throughputLogsPerSecond) / previousBaseline.logging.throughputLogsPerSecond) * 100;
      if (throughputChange < -this.config.regressionThreshold) {
        regressions.push(`Logging throughput decreased by ${Math.abs(throughputChange).toFixed(1)}%`);
        score -= 25;
      } else if (throughputChange > 5) {
        improvements.push(`Logging throughput improved by ${throughputChange.toFixed(1)}%`);
        score += 10;
      }
      
      this.results.regressionAnalysis = {
        hasRegressions: regressions.length > 0,
        regressions,
        improvements,
        overallScore: Math.max(0, Math.min(100, score))
      };
      
      // Save regression analysis
      const regressionPath = path.join(this.config.outputDir, 'regression-analysis.json');
      await fs.writeFile(regressionPath, JSON.stringify(this.results.regressionAnalysis, null, 2), 'utf8');
      
      if (regressions.length > 0) {
        console.log('⚠️  Performance regressions detected:');
        regressions.forEach(regression => console.log(`   • ${regression}`));
      }
      
      if (improvements.length > 0) {
        console.log('✅ Performance improvements detected:');
        improvements.forEach(improvement => console.log(`   • ${improvement}`));
      }
      
      console.log(`📊 Overall Performance Score: ${this.results.regressionAnalysis.overallScore}/100`);
      
    } catch (error) {
      const errorMsg = `Regression analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error('❌', errorMsg);
      this.results.errors.push(errorMsg);
    }
  }

  private findPreviousBaseline(): string | null {
    // In a real implementation, this would look for the most recent baseline
    // from a shared location or CI/CD artifacts
    const testResultsDir = path.dirname(this.config.outputDir);
    
    try {
      // This is a simplified implementation
      // In practice, you'd want to search for the most recent successful baseline
      const baselinePath = path.join(testResultsDir, 'latest-baseline', 'baseline-metrics.json');
      if (require('fs').existsSync(baselinePath)) {
        return baselinePath;
      }
    } catch (error) {
      // Ignore errors - baseline may not exist
    }
    
    return null;
  }

  private async generateReports(): Promise<void> {
    console.log('\n📊 Phase 5: Generating Comprehensive Report');
    
    try {
      const comprehensiveReport = this.generateComprehensiveReport();
      const reportPath = path.join(this.config.outputDir, 'comprehensive-report.md');
      await fs.writeFile(reportPath, comprehensiveReport, 'utf8');
      
      // Generate JSON summary for automated processing
      const summaryPath = path.join(this.config.outputDir, 'test-summary.json');
      await fs.writeFile(summaryPath, JSON.stringify(this.results, null, 2), 'utf8');
      
      // Create latest symlink for easy access
      const latestDir = path.join(path.dirname(this.config.outputDir), 'latest');
      try {
        await fs.unlink(latestDir);
      } catch {} // Ignore if doesn't exist
      
      await fs.symlink(path.basename(this.config.outputDir), latestDir);
      
      console.log('✅ Reports generated');
      console.log(`   Main report: ${reportPath}`);
      console.log(`   Latest results: ${latestDir}`);
      
    } catch (error) {
      const errorMsg = `Report generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error('❌', errorMsg);
      this.results.errors.push(errorMsg);
    }
  }

  private generateComprehensiveReport(): string {
    const duration = this.results.duration;
    const success = this.results.success ? '✅ PASSED' : '❌ FAILED';
    
    return `# Performance Test Orchestration Report

**Test ID**: ${this.results.orchestrationId}
**Date**: ${this.results.timestamp}
**Duration**: ${duration.toFixed(1)} seconds
**Status**: ${success}

## Executive Summary

This report presents the comprehensive performance testing results for the Seq logging system baseline establishment and migration preparation.

${this.results.errors.length > 0 ? `
### 🚨 Issues Detected
${this.results.errors.map(error => `- ${error}`).join('\n')}
` : ''}

## Test Results Overview

### Baseline Performance Testing
${this.results.baseline ? `
**Status**: ✅ Completed

**Key Metrics**:
- **Logging Latency**: ${this.results.baseline.logging.avgLatencyMs.toFixed(3)}ms average
- **Request Overhead**: ${this.results.baseline.endToEnd.loggingOverheadMs.toFixed(2)}ms (${this.results.baseline.endToEnd.overheadPercentage.toFixed(1)}%)
- **Memory Growth**: ${this.results.baseline.system.memoryGrowthMb}MB
- **Logging Throughput**: ${Math.round(this.results.baseline.logging.throughputLogsPerSecond)} logs/second

**Target Compliance**:
- ${this.results.baseline.endToEnd.loggingOverheadMs <= PERFORMANCE_TARGETS.latencyImpactPerRequest ? '✅' : '❌'} Latency Target: ${this.results.baseline.endToEnd.loggingOverheadMs.toFixed(2)}ms ≤ ${PERFORMANCE_TARGETS.latencyImpactPerRequest}ms
- ${this.results.baseline.system.memoryGrowthMb <= PERFORMANCE_TARGETS.memoryOverhead ? '✅' : '❌'} Memory Target: ${this.results.baseline.system.memoryGrowthMb}MB ≤ ${PERFORMANCE_TARGETS.memoryOverhead}MB
` : '**Status**: ⏭️ Skipped or Failed'}

### Load Testing
${this.results.loadTests ? `
**Status**: ✅ Completed

**Test Scenarios**: ${Object.keys(this.results.loadTests).length}

**Performance Summary**:
${Object.entries(this.results.loadTests).map(([name, metrics]) => `
- **${name.replace(/_/g, ' ').toUpperCase()}**:
  - RPS: ${metrics.overview.averageRPS.toFixed(1)}
  - P95 Latency: ${metrics.latency.p95.toFixed(1)}ms
  - Error Rate: ${(metrics.overview.errorRate * 100).toFixed(2)}%
  - Peak Memory: ${metrics.resources.peakMemoryMB.toFixed(1)}MB`).join('')}
` : '**Status**: ⏭️ Skipped or Failed'}

### Performance Monitoring
${this.results.monitoring ? `
**Status**: ✅ Completed

**Duration**: ${this.results.monitoring.duration} seconds
**Alerts Triggered**: ${this.results.monitoring.alerts}
**Report**: [monitoring-report.md](monitoring-report.md)
` : '**Status**: ⏭️ Skipped'}

### Regression Analysis
${this.results.regressionAnalysis ? `
**Status**: ✅ Completed

**Performance Score**: ${this.results.regressionAnalysis.overallScore}/100

${this.results.regressionAnalysis.hasRegressions ? `
**🚨 Regressions Detected**:
${this.results.regressionAnalysis.regressions.map(r => `- ${r}`).join('\n')}
` : '**✅ No Regressions Detected**'}

${this.results.regressionAnalysis.improvements.length > 0 ? `
**📈 Improvements Detected**:
${this.results.regressionAnalysis.improvements.map(i => `- ${i}`).join('\n')}
` : ''}
` : '**Status**: ⏭️ Skipped'}

## Migration Recommendations

Based on the performance testing results:

### Pre-Migration Checklist
- [ ] Verify current performance meets baseline targets
- [ ] Ensure monitoring systems are in place
- [ ] Prepare rollback procedures
- [ ] Set up dual logging for validation period

### Migration Phase Validation
- [ ] Run comparative performance tests
- [ ] Monitor resource utilization trends
- [ ] Validate alert thresholds and responses
- [ ] Confirm data consistency between systems

### Post-Migration Validation
- [ ] Execute full regression test suite
- [ ] Validate performance improvements
- [ ] Update monitoring dashboards
- [ ] Document lessons learned

## Technical Recommendations

### Performance Optimization
${this.generateTechnicalRecommendations()}

### Monitoring and Alerting
- Continue performance monitoring during migration
- Set up alerts for regression detection
- Monitor memory usage patterns for leaks
- Track logging system health metrics

## Files Generated

- [baseline-report.md](baseline-report.md) - Detailed baseline performance analysis
- [load-test-report.md](load-test-report.md) - Comprehensive load testing results
${this.results.monitoring ? '- [monitoring-report.md](monitoring-report.md) - Real-time monitoring analysis' : ''}
- [test-summary.json](test-summary.json) - Machine-readable test results
- [baseline-metrics.json](baseline-metrics.json) - Raw baseline performance data
- [load-test-results.json](load-test-results.json) - Raw load testing data

---

**Generated by**: Performance Test Orchestrator
**Node.js Version**: ${process.version}
**Platform**: ${process.platform} ${process.arch}
**Test Duration**: ${duration.toFixed(1)} seconds
`;
  }

  private generateTechnicalRecommendations(): string {
    const recommendations: string[] = [];
    
    if (this.results.baseline) {
      if (this.results.baseline.endToEnd.loggingOverheadMs > PERFORMANCE_TARGETS.latencyImpactPerRequest) {
        recommendations.push('• Current logging overhead exceeds target - optimize before migration');
      }
      
      if (this.results.baseline.system.memoryGrowthMb > PERFORMANCE_TARGETS.memoryOverhead) {
        recommendations.push('• Memory usage growth is high - investigate potential memory leaks');
      }
      
      if (this.results.baseline.logging.errorRate > 0.01) {
        recommendations.push('• Logging error rate is elevated - check Seq connectivity and configuration');
      }
    }
    
    if (this.results.loadTests) {
      const hasHighLatency = Object.values(this.results.loadTests).some(
        metrics => metrics.latency.p95 > 2000
      );
      if (hasHighLatency) {
        recommendations.push('• High P95 latencies detected under load - review application performance');
      }
      
      const hasHighErrorRate = Object.values(this.results.loadTests).some(
        metrics => metrics.overview.errorRate > 0.05
      );
      if (hasHighErrorRate) {
        recommendations.push('• High error rates under load - investigate error patterns and causes');
      }
    }
    
    return recommendations.length > 0 ? 
      recommendations.join('\n') : 
      '• No specific performance issues identified - system appears ready for migration';
  }

  private validateBaselineTargets(baseline: BaselineMetrics): boolean {
    return baseline.endToEnd.loggingOverheadMs <= PERFORMANCE_TARGETS.latencyImpactPerRequest &&
           baseline.system.memoryGrowthMb <= PERFORMANCE_TARGETS.memoryOverhead &&
           baseline.logging.errorRate <= 0.05; // 5% error rate threshold
  }

  private validateLoadTestResults(loadTests: Record<string, LoadTestMetrics>): boolean {
    return Object.values(loadTests).some(metrics => 
      metrics.overview.errorRate > 0.1 || // 10% error rate threshold for load tests
      metrics.latency.p95 > 5000 // 5 second P95 threshold for load tests
    );
  }

  private async cleanup(): Promise<void> {
    if (!this.config.skipCleanup) {
      console.log('\n🧹 Cleaning up test resources...');
      
      try {
        if (this.baseline) {
          await this.baseline.cleanup();
        }
        
        if (this.loadTesting) {
          await this.loadTesting.cleanup();
        }
        
        if (this.monitoring) {
          await this.monitoring.cleanup();
        }
        
        console.log('✅ Cleanup completed');
      } catch (error) {
        console.warn('⚠️  Cleanup warning:', error instanceof Error ? error.message : 'Unknown error');
      }
    }
  }
}

// CLI interface for standalone execution
async function main() {
  const args = process.argv.slice(2);
  const config: Partial<OrchestrationConfig> = {};
  
  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--output-dir':
        config.outputDir = args[++i];
        break;
      case '--skip-baseline':
        config.runBaseline = false;
        break;
      case '--skip-load-tests':
        config.runLoadTests = false;
        break;
      case '--enable-monitoring':
        config.runMonitoring = true;
        break;
      case '--monitoring-duration':
        config.monitoringDuration = parseInt(args[++i]);
        break;
      case '--regression-threshold':
        config.regressionThreshold = parseFloat(args[++i]);
        break;
      case '--skip-cleanup':
        config.skipCleanup = true;
        break;
      case '--help':
        console.log(`
Performance Test Orchestration Script

Usage: node orchestration.js [options]

Options:
  --output-dir <dir>          Output directory for test results
  --skip-baseline             Skip baseline performance tests
  --skip-load-tests          Skip load testing phase
  --enable-monitoring        Enable real-time monitoring phase
  --monitoring-duration <s>  Monitoring duration in seconds (default: 300)
  --regression-threshold <p> Regression threshold percentage (default: 15)
  --skip-cleanup            Skip cleanup of test resources
  --help                     Show this help message

Examples:
  node orchestration.js --output-dir ./results
  node orchestration.js --enable-monitoring --monitoring-duration 600
  node orchestration.js --skip-baseline --regression-threshold 10
        `);
        process.exit(0);
    }
  }
  
  const orchestrator = new PerformanceTestOrchestrator(config);
  
  try {
    const results = await orchestrator.execute();
    
    console.log('\n🎯 Performance Test Orchestration Complete');
    console.log(`📊 Results: ${results.success ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`⏱️  Duration: ${results.duration.toFixed(1)} seconds`);
    console.log(`📁 Output: ${config.outputDir || 'default location'}`);
    
    if (results.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      results.errors.forEach(error => console.log(`   • ${error}`));
    }
    
    if (results.regressionAnalysis) {
      console.log(`\n📈 Performance Score: ${results.regressionAnalysis.overallScore}/100`);
      
      if (results.regressionAnalysis.hasRegressions) {
        console.log('⚠️  Regressions detected - review detailed reports');
      }
    }
    
    // Exit with appropriate code for CI/CD integration
    process.exit(results.success ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Orchestration failed:', error);
    process.exit(1);
  }
}

export { PerformanceTestOrchestrator, OrchestrationConfig, TestResults };

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}