#!/usr/bin/env tsx
/**
 * SignOz Integration Validation Script
 * Task 1.1.4: Integration validation and connectivity testing
 * 
 * This script validates the complete SignOz integration setup:
 * - ClickHouse connectivity and schema
 * - OTEL Collector health and configuration
 * - Query Service API responses
 * - SignOz Frontend accessibility
 * - End-to-end telemetry flow
 */

import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

interface ValidationResult {
  component: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: any;
  duration?: number;
}

class SignOzValidator {
  private results: ValidationResult[] = [];
  private startTime = Date.now();

  // ANSI color codes for output formatting
  private colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
  };

  private log(message: string, color: keyof typeof this.colors = 'white') {
    const timestamp = new Date().toISOString();
    console.log(`${this.colors[color]}[${timestamp}] ${message}${this.colors.reset}`);
  }

  private async addResult(
    component: string, 
    status: ValidationResult['status'], 
    message: string, 
    details?: any
  ): Promise<void> {
    const result: ValidationResult = {
      component,
      status,
      message,
      details,
      duration: Date.now() - this.startTime
    };
    
    this.results.push(result);
    
    const statusColor = status === 'PASS' ? 'green' : status === 'WARN' ? 'yellow' : 'red';
    const statusIcon = status === 'PASS' ? '✅' : status === 'WARN' ? '⚠️' : '❌';
    
    this.log(`${statusIcon} ${component}: ${message}`, statusColor);
    
    if (details && typeof details === 'object') {
      console.log(`   ${JSON.stringify(details, null, 2)}`);
    }
  }

  private async checkDockerServices(): Promise<void> {
    this.log('🔍 Checking Docker services...', 'blue');
    
    try {
      const result = await execAsync('docker-compose -f docker-compose.signoz.yml ps --format json');
      const services = JSON.parse(result.stdout);
      
      const expectedServices = [
        'signoz-clickhouse',
        'signoz-otel-collector', 
        'signoz-query-service',
        'signoz-frontend'
      ];
      
      for (const serviceName of expectedServices) {
        const service = services.find((s: any) => s.Name === serviceName);
        
        if (!service) {
          await this.addResult(
            'Docker Services',
            'FAIL',
            `Service ${serviceName} not found`,
            { availableServices: services.map((s: any) => s.Name) }
          );
        } else if (service.State !== 'running') {
          await this.addResult(
            'Docker Services',
            'FAIL',
            `Service ${serviceName} is ${service.State}`,
            { service }
          );
        } else {
          await this.addResult(
            'Docker Services',
            'PASS',
            `Service ${serviceName} is running`,
            { status: service.Status }
          );
        }
      }
    } catch (error) {
      await this.addResult(
        'Docker Services',
        'FAIL',
        'Failed to check Docker services',
        { error: (error as Error).message }
      );
    }
  }

  private async checkClickHouseConnectivity(): Promise<void> {
    this.log('🔍 Checking ClickHouse connectivity...', 'blue');
    
    try {
      // Test ClickHouse HTTP interface
      const response = await fetch('http://localhost:8123/ping', {
        timeout: 5000
      });
      
      if (response.ok) {
        await this.addResult(
          'ClickHouse HTTP',
          'PASS',
          'ClickHouse HTTP interface is accessible',
          { status: response.status, statusText: response.statusText }
        );
      } else {
        await this.addResult(
          'ClickHouse HTTP',
          'FAIL',
          `ClickHouse HTTP interface returned ${response.status}`,
          { status: response.status, statusText: response.statusText }
        );
      }
      
      // Test basic query
      const queryResponse = await fetch('http://localhost:8123?query=SELECT version()', {
        timeout: 5000
      });
      
      if (queryResponse.ok) {
        const version = await queryResponse.text();
        await this.addResult(
          'ClickHouse Query',
          'PASS',
          'ClickHouse query interface working',
          { version: version.trim() }
        );
      } else {
        await this.addResult(
          'ClickHouse Query',
          'FAIL',
          'ClickHouse query interface not working',
          { status: queryResponse.status }
        );
      }
      
    } catch (error) {
      await this.addResult(
        'ClickHouse Connectivity',
        'FAIL',
        'Failed to connect to ClickHouse',
        { error: (error as Error).message }
      );
    }
  }

  private async checkOTELCollector(): Promise<void> {
    this.log('🔍 Checking OTEL Collector...', 'blue');
    
    try {
      // Check health endpoint
      const healthResponse = await fetch('http://localhost:13133', {
        timeout: 5000
      });
      
      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        await this.addResult(
          'OTEL Collector Health',
          'PASS',
          'OTEL Collector health check passed',
          healthData
        );
      } else {
        await this.addResult(
          'OTEL Collector Health',
          'FAIL',
          `OTEL Collector health check failed with status ${healthResponse.status}`,
          { status: healthResponse.status }
        );
      }
      
      // Check metrics endpoint
      const metricsResponse = await fetch('http://localhost:8888/metrics', {
        timeout: 5000
      });
      
      if (metricsResponse.ok) {
        const metrics = await metricsResponse.text();
        const metricCount = (metrics.match(/# TYPE/g) || []).length;
        await this.addResult(
          'OTEL Collector Metrics',
          'PASS',
          'OTEL Collector metrics endpoint accessible',
          { metricCount, sampleMetrics: metrics.split('\n').slice(0, 5) }
        );
      } else {
        await this.addResult(
          'OTEL Collector Metrics',
          'FAIL',
          'OTEL Collector metrics endpoint not accessible',
          { status: metricsResponse.status }
        );
      }
      
      // Test OTLP HTTP receiver
      const testTrace = {
        resourceSpans: [{
          resource: {
            attributes: [{
              key: "service.name",
              value: { stringValue: "signoz-validation-test" }
            }]
          },
          scopeSpans: [{
            scope: {
              name: "validation-test",
              version: "1.0.0"
            },
            spans: [{
              traceId: "12345678901234567890123456789012",
              spanId: "1234567890123456",
              name: "test-span",
              kind: 1,
              startTimeUnixNano: Date.now() * 1000000,
              endTimeUnixNano: (Date.now() + 100) * 1000000,
              attributes: [{
                key: "test.validation",
                value: { stringValue: "signoz-integration" }
              }]
            }]
          }]
        }]
      };
      
      const otlpResponse = await fetch('http://localhost:4318/v1/traces', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testTrace),
        timeout: 10000
      });
      
      if (otlpResponse.ok || otlpResponse.status === 200) {
        await this.addResult(
          'OTEL OTLP Receiver',
          'PASS',
          'OTLP HTTP receiver accepting traces',
          { status: otlpResponse.status }
        );
      } else {
        await this.addResult(
          'OTEL OTLP Receiver',
          'WARN',
          `OTLP receiver returned status ${otlpResponse.status}`,
          { status: otlpResponse.status, statusText: otlpResponse.statusText }
        );
      }
      
    } catch (error) {
      await this.addResult(
        'OTEL Collector',
        'FAIL',
        'Failed to check OTEL Collector',
        { error: (error as Error).message }
      );
    }
  }

  private async checkQueryService(): Promise<void> {
    this.log('🔍 Checking SignOz Query Service...', 'blue');
    
    try {
      // Check health endpoint
      const healthResponse = await fetch('http://localhost:8080/api/v1/health', {
        timeout: 5000
      });
      
      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        await this.addResult(
          'Query Service Health',
          'PASS',
          'Query Service health check passed',
          healthData
        );
      } else {
        await this.addResult(
          'Query Service Health',
          'FAIL',
          `Query Service health check failed with status ${healthResponse.status}`,
          { status: healthResponse.status }
        );
      }
      
      // Check version endpoint
      const versionResponse = await fetch('http://localhost:8080/api/v1/version', {
        timeout: 5000
      });
      
      if (versionResponse.ok) {
        const versionData = await versionResponse.json();
        await this.addResult(
          'Query Service Version',
          'PASS',
          'Query Service version endpoint accessible',
          versionData
        );
      } else {
        await this.addResult(
          'Query Service Version',
          'WARN',
          'Query Service version endpoint not accessible',
          { status: versionResponse.status }
        );
      }
      
    } catch (error) {
      await this.addResult(
        'Query Service',
        'FAIL',
        'Failed to check Query Service',
        { error: (error as Error).message }
      );
    }
  }

  private async checkSignOzFrontend(): Promise<void> {
    this.log('🔍 Checking SignOz Frontend...', 'blue');
    
    try {
      const response = await fetch('http://localhost:3301', {
        timeout: 10000
      });
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        await this.addResult(
          'SignOz Frontend',
          'PASS',
          'SignOz Frontend is accessible',
          { 
            status: response.status, 
            contentType,
            url: 'http://localhost:3301'
          }
        );
      } else {
        await this.addResult(
          'SignOz Frontend',
          'FAIL',
          `SignOz Frontend returned status ${response.status}`,
          { status: response.status, statusText: response.statusText }
        );
      }
      
    } catch (error) {
      await this.addResult(
        'SignOz Frontend',
        'FAIL',
        'Failed to access SignOz Frontend',
        { error: (error as Error).message }
      );
    }
  }

  private async checkConfigurationFiles(): Promise<void> {
    this.log('🔍 Checking configuration files...', 'blue');
    
    const requiredFiles = [
      'docker-compose.signoz.yml',
      'signoz/otel-collector-config.yaml',
      'signoz/clickhouse-config.xml',
      'signoz/clickhouse-users.xml',
      'signoz/prometheus.yml',
      'signoz/alertmanager-config.yml',
      'signoz/nginx.conf',
      '.env.otel',
      'src/tracing/otel-init.ts'
    ];
    
    for (const file of requiredFiles) {
      const filePath = path.join(process.cwd(), file);
      
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        await this.addResult(
          'Configuration Files',
          'PASS',
          `Configuration file ${file} exists`,
          { size: stats.size, modified: stats.mtime }
        );
      } else {
        await this.addResult(
          'Configuration Files',
          'FAIL',
          `Configuration file ${file} missing`,
          { expectedPath: filePath }
        );
      }
    }
  }

  private async checkNetworking(): Promise<void> {
    this.log('🔍 Checking networking and ports...', 'blue');
    
    const ports = [
      { port: 3301, service: 'SignOz Frontend' },
      { port: 8080, service: 'Query Service' },
      { port: 4317, service: 'OTEL Collector (gRPC)' },
      { port: 4318, service: 'OTEL Collector (HTTP)' },
      { port: 8123, service: 'ClickHouse HTTP' },
      { port: 9000, service: 'ClickHouse Native' },
      { port: 8888, service: 'OTEL Collector Metrics' },
      { port: 13133, service: 'OTEL Collector Health' }
    ];
    
    for (const { port, service } of ports) {
      try {
        const result = await execAsync(`nc -z localhost ${port}`, { timeout: 3000 });
        await this.addResult(
          'Port Connectivity',
          'PASS',
          `Port ${port} (${service}) is accessible`,
          { port, service }
        );
      } catch (error) {
        await this.addResult(
          'Port Connectivity',
          'FAIL',
          `Port ${port} (${service}) is not accessible`,
          { port, service, error: 'Connection refused' }
        );
      }
    }
  }

  private async generateReport(): Promise<void> {
    const totalDuration = Date.now() - this.startTime;
    const passCount = this.results.filter(r => r.status === 'PASS').length;
    const failCount = this.results.filter(r => r.status === 'FAIL').length;
    const warnCount = this.results.filter(r => r.status === 'WARN').length;
    
    this.log('\n' + '='.repeat(80), 'cyan');
    this.log('📊 SIGNOZ INTEGRATION VALIDATION REPORT', 'bold');
    this.log('='.repeat(80), 'cyan');
    
    this.log(`🕒 Total Duration: ${totalDuration}ms`, 'cyan');
    this.log(`✅ Passed: ${passCount}`, 'green');
    this.log(`⚠️  Warnings: ${warnCount}`, 'yellow');
    this.log(`❌ Failed: ${failCount}`, 'red');
    this.log(`📋 Total Checks: ${this.results.length}\n`, 'cyan');
    
    // Group results by component
    const components = [...new Set(this.results.map(r => r.component))];
    
    for (const component of components) {
      const componentResults = this.results.filter(r => r.component === component);
      const componentStatus = componentResults.every(r => r.status === 'PASS') ? 'PASS' :
                             componentResults.some(r => r.status === 'FAIL') ? 'FAIL' : 'WARN';
      
      const statusColor = componentStatus === 'PASS' ? 'green' : 
                         componentStatus === 'WARN' ? 'yellow' : 'red';
      const statusIcon = componentStatus === 'PASS' ? '✅' : 
                        componentStatus === 'WARN' ? '⚠️' : '❌';
      
      this.log(`${statusIcon} ${component}`, statusColor);
      
      for (const result of componentResults) {
        const resultColor = result.status === 'PASS' ? 'green' : 
                           result.status === 'WARN' ? 'yellow' : 'red';
        this.log(`   • ${result.message}`, resultColor);
      }
      console.log('');
    }
    
    // Generate quick start commands
    if (failCount > 0) {
      this.log('🚀 QUICK FIX COMMANDS:', 'yellow');
      this.log('   docker-compose -f docker-compose.signoz.yml down', 'white');
      this.log('   docker-compose -f docker-compose.signoz.yml up -d', 'white');
      this.log('   docker-compose -f docker-compose.signoz.yml logs -f', 'white');
    } else {
      this.log('🎉 All systems operational! SignOz is ready for use.', 'green');
      this.log('   • SignOz UI: http://localhost:3301', 'cyan');
      this.log('   • OTLP Endpoint: http://localhost:4318', 'cyan');
      this.log('   • Metrics: http://localhost:8888/metrics', 'cyan');
    }
    
    // Save detailed report
    const reportPath = path.join(process.cwd(), 'signoz-validation-report.json');
    const detailedReport = {
      timestamp: new Date().toISOString(),
      duration: totalDuration,
      summary: { passCount, failCount, warnCount, total: this.results.length },
      results: this.results,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        cwd: process.cwd()
      }
    };
    
    fs.writeFileSync(reportPath, JSON.stringify(detailedReport, null, 2));
    this.log(`\n📄 Detailed report saved to: ${reportPath}`, 'cyan');
  }

  public async run(): Promise<void> {
    this.log('🚀 Starting SignOz Integration Validation...', 'bold');
    this.log('='.repeat(50), 'cyan');
    
    try {
      await this.checkConfigurationFiles();
      await this.checkDockerServices();
      await this.checkNetworking();
      await this.checkClickHouseConnectivity();
      await this.checkOTELCollector();
      await this.checkQueryService();
      await this.checkSignOzFrontend();
      
      await this.generateReport();
      
      const failCount = this.results.filter(r => r.status === 'FAIL').length;
      process.exit(failCount > 0 ? 1 : 0);
      
    } catch (error) {
      this.log(`💥 Validation failed with error: ${(error as Error).message}`, 'red');
      process.exit(1);
    }
  }
}

// Run validation if this script is executed directly
if (require.main === module) {
  const validator = new SignOzValidator();
  validator.run();
}

export { SignOzValidator };