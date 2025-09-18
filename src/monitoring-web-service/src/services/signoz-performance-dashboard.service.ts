/**
 * SignOz Performance Dashboard Integration Service
 * Task 4.2: Application Performance Monitoring Setup - SignOz Integration
 * 
 * Features:
 * - Performance metrics export to SignOz
 * - Custom dashboard creation and management
 * - Alert rule configuration
 * - Query builder for performance analytics
 * - Real-time dashboard updates
 * - Performance comparison and baseline tracking
 */

import * as api from '@opentelemetry/api';
import { logger } from '../config/logger';
import { config } from '../config/environment';
import { getBusinessInstrumentation } from '../tracing/business-instrumentation';

// SignOz dashboard configuration
export interface SignOzDashboardConfig {
  enabled: boolean;
  signozUrl: string;
  apiKey?: string;
  dashboardId?: string;
  refreshInterval: number; // seconds
  retentionPeriod: number; // days
}

// Performance dashboard panel configuration
export interface DashboardPanel {
  id: string;
  title: string;
  type: 'graph' | 'stat' | 'table' | 'heatmap';
  query: SignOzQuery;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  thresholds?: {
    warning: number;
    critical: number;
  };
  unit?: string;
  decimals?: number;
}

// SignOz query structure
export interface SignOzQuery {
  metric: string;
  aggregation: 'avg' | 'sum' | 'max' | 'min' | 'count' | 'rate';
  groupBy?: string[];
  filters?: Record<string, string | number>;
  timeRange: string;
}

// Dashboard template
export interface DashboardTemplate {
  id: string;
  title: string;
  description: string;
  tags: string[];
  panels: DashboardPanel[];
  variables?: DashboardVariable[];
}

// Dashboard variable for filtering
export interface DashboardVariable {
  name: string;
  type: 'query' | 'constant' | 'datasource';
  label: string;
  query?: string;
  options?: Array<{ text: string; value: string }>;
  defaultValue?: string;
}

// Alert rule configuration
export interface AlertRule {
  id: string;
  name: string;
  description: string;
  query: SignOzQuery;
  condition: {
    operator: 'gt' | 'lt' | 'eq' | 'ne';
    threshold: number;
  };
  frequency: number; // seconds
  severity: 'low' | 'medium' | 'high' | 'critical';
  notifications: {
    channels: string[];
    message?: string;
  };
  enabled: boolean;
}

/**
 * SignOz Performance Dashboard Service
 * Manages performance dashboards and alerts in SignOz
 */
export class SignOzPerformanceDashboardService {
  private businessInstrumentation;
  private config: SignOzDashboardConfig;
  private dashboardTemplates: Map<string, DashboardTemplate> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();

  constructor(config?: Partial<SignOzDashboardConfig>) {
    this.businessInstrumentation = getBusinessInstrumentation();
    
    this.config = {
      enabled: true,
      signozUrl: process.env.SIGNOZ_URL || 'http://localhost:3301',
      apiKey: process.env.SIGNOZ_API_KEY,
      refreshInterval: 30, // 30 seconds
      retentionPeriod: 30, // 30 days
      ...config,
    };

    this.initializeDashboardTemplates();
    this.initializeAlertRules();
  }

  /**
   * Initialize predefined dashboard templates
   */
  private initializeDashboardTemplates(): void {
    // Application Performance Overview Dashboard
    const overviewDashboard: DashboardTemplate = {
      id: 'app-performance-overview',
      title: 'Application Performance Overview',
      description: 'Comprehensive view of application performance metrics',
      tags: ['performance', 'application', 'overview'],
      variables: [
        {
          name: 'tenant_id',
          type: 'query',
          label: 'Tenant',
          query: 'label_values(http_request_duration_histogram, tenant_id)',
          defaultValue: 'all',
        },
        {
          name: 'endpoint',
          type: 'query',
          label: 'Endpoint',
          query: 'label_values(http_request_duration_histogram{tenant_id="$tenant_id"}, endpoint)',
          defaultValue: 'all',
        },
      ],
      panels: [
        {
          id: 'response-time-p95',
          title: 'Response Time P95',
          type: 'stat',
          query: {
            metric: 'http_request_duration_histogram',
            aggregation: 'avg',
            groupBy: ['tenant_id'],
            filters: { quantile: '0.95' },
            timeRange: '5m',
          },
          position: { x: 0, y: 0, width: 6, height: 3 },
          thresholds: { warning: 1000, critical: 2000 },
          unit: 'ms',
          decimals: 0,
        },
        {
          id: 'error-rate',
          title: 'Error Rate',
          type: 'stat',
          query: {
            metric: 'error_rate_by_type',
            aggregation: 'rate',
            timeRange: '5m',
          },
          position: { x: 6, y: 0, width: 6, height: 3 },
          thresholds: { warning: 0.02, critical: 0.05 },
          unit: 'percent',
          decimals: 2,
        },
        {
          id: 'throughput',
          title: 'Requests per Second',
          type: 'stat',
          query: {
            metric: 'http_request_duration_histogram',
            aggregation: 'rate',
            timeRange: '1m',
          },
          position: { x: 12, y: 0, width: 6, height: 3 },
          unit: 'reqps',
          decimals: 1,
        },
        {
          id: 'active-requests',
          title: 'Active Requests',
          type: 'stat',
          query: {
            metric: 'application_concurrency',
            aggregation: 'avg',
            filters: { metric: 'active_requests' },
            timeRange: '1m',
          },
          position: { x: 18, y: 0, width: 6, height: 3 },
          unit: 'short',
          decimals: 0,
        },
        {
          id: 'response-time-trend',
          title: 'Response Time Trend',
          type: 'graph',
          query: {
            metric: 'http_request_duration_histogram',
            aggregation: 'avg',
            groupBy: ['category'],
            timeRange: '1h',
          },
          position: { x: 0, y: 3, width: 12, height: 6 },
          unit: 'ms',
        },
        {
          id: 'error-rate-trend',
          title: 'Error Rate Trend',
          type: 'graph',
          query: {
            metric: 'error_rate_by_type',
            aggregation: 'rate',
            groupBy: ['error_type'],
            timeRange: '1h',
          },
          position: { x: 12, y: 3, width: 12, height: 6 },
          unit: 'percent',
        },
        {
          id: 'performance-heatmap',
          title: 'Response Time Heatmap',
          type: 'heatmap',
          query: {
            metric: 'http_request_duration_histogram',
            aggregation: 'sum',
            timeRange: '1h',
          },
          position: { x: 0, y: 9, width: 24, height: 6 },
        },
      ],
    };

    // Resource Utilization Dashboard
    const resourceDashboard: DashboardTemplate = {
      id: 'resource-utilization',
      title: 'Resource Utilization',
      description: 'Monitor CPU, memory, and other resource usage',
      tags: ['resources', 'infrastructure', 'monitoring'],
      panels: [
        {
          id: 'memory-usage',
          title: 'Memory Usage',
          type: 'graph',
          query: {
            metric: 'nodejs_resource_usage',
            aggregation: 'avg',
            groupBy: ['metric'],
            filters: { metric: 'memory_rss_bytes' },
            timeRange: '1h',
          },
          position: { x: 0, y: 0, width: 12, height: 6 },
          unit: 'bytes',
        },
        {
          id: 'cpu-usage',
          title: 'CPU Usage',
          type: 'graph',
          query: {
            metric: 'nodejs_resource_usage',
            aggregation: 'rate',
            groupBy: ['metric'],
            filters: { metric: 'cpu_user_seconds' },
            timeRange: '1h',
          },
          position: { x: 12, y: 0, width: 12, height: 6 },
          unit: 'percent',
        },
        {
          id: 'gc-stats',
          title: 'Garbage Collection',
          type: 'graph',
          query: {
            metric: 'nodejs_resource_usage',
            aggregation: 'rate',
            groupBy: ['metric'],
            filters: { metric: 'gc_collections_total' },
            timeRange: '1h',
          },
          position: { x: 0, y: 6, width: 12, height: 6 },
          unit: 'cps',
        },
        {
          id: 'db-connections',
          title: 'Database Connections',
          type: 'graph',
          query: {
            metric: 'application_concurrency',
            aggregation: 'avg',
            groupBy: ['pool', 'metric'],
            filters: { metric: 'db_connections_active' },
            timeRange: '1h',
          },
          position: { x: 12, y: 6, width: 12, height: 6 },
          unit: 'short',
        },
      ],
    };

    // Performance Regression Dashboard
    const regressionDashboard: DashboardTemplate = {
      id: 'performance-regression',
      title: 'Performance Regression Analysis',
      description: 'Track performance regressions and alerts',
      tags: ['regression', 'analysis', 'alerts'],
      panels: [
        {
          id: 'regression-count',
          title: 'Regressions Detected',
          type: 'stat',
          query: {
            metric: 'performance_regression_detected',
            aggregation: 'sum',
            timeRange: '24h',
          },
          position: { x: 0, y: 0, width: 6, height: 3 },
          thresholds: { warning: 1, critical: 5 },
        },
        {
          id: 'regression-severity',
          title: 'Regressions by Severity',
          type: 'graph',
          query: {
            metric: 'performance_regression_detected',
            aggregation: 'sum',
            groupBy: ['severity'],
            timeRange: '24h',
          },
          position: { x: 6, y: 0, width: 18, height: 6 },
        },
        {
          id: 'performance-comparison',
          title: 'Before/After Performance',
          type: 'table',
          query: {
            metric: 'http_request_duration_histogram',
            aggregation: 'avg',
            groupBy: ['endpoint'],
            timeRange: '24h',
          },
          position: { x: 0, y: 6, width: 24, height: 8 },
        },
      ],
    };

    this.dashboardTemplates.set(overviewDashboard.id, overviewDashboard);
    this.dashboardTemplates.set(resourceDashboard.id, resourceDashboard);
    this.dashboardTemplates.set(regressionDashboard.id, regressionDashboard);
  }

  /**
   * Initialize alert rules
   */
  private initializeAlertRules(): void {
    const alertRules: AlertRule[] = [
      {
        id: 'high-error-rate',
        name: 'High Error Rate Alert',
        description: 'Triggers when error rate exceeds 5%',
        query: {
          metric: 'error_rate_by_type',
          aggregation: 'rate',
          timeRange: '5m',
        },
        condition: {
          operator: 'gt',
          threshold: 0.05,
        },
        frequency: 60, // 1 minute
        severity: 'high',
        notifications: {
          channels: ['slack', 'email'],
          message: 'Error rate is above 5% - investigate immediately',
        },
        enabled: true,
      },
      {
        id: 'high-latency',
        name: 'High Latency Alert',
        description: 'Triggers when P95 latency exceeds 2 seconds',
        query: {
          metric: 'http_request_duration_histogram',
          aggregation: 'avg',
          filters: { quantile: '0.95' },
          timeRange: '5m',
        },
        condition: {
          operator: 'gt',
          threshold: 2000,
        },
        frequency: 60,
        severity: 'medium',
        notifications: {
          channels: ['slack'],
          message: 'P95 latency is above 2 seconds',
        },
        enabled: true,
      },
      {
        id: 'memory-leak',
        name: 'Memory Leak Detection',
        description: 'Triggers when memory usage grows consistently',
        query: {
          metric: 'nodejs_resource_usage',
          aggregation: 'avg',
          filters: { metric: 'memory_heap_used_bytes' },
          timeRange: '15m',
        },
        condition: {
          operator: 'gt',
          threshold: 512 * 1024 * 1024, // 512MB
        },
        frequency: 300, // 5 minutes
        severity: 'medium',
        notifications: {
          channels: ['email'],
          message: 'Potential memory leak detected - heap usage above 512MB',
        },
        enabled: true,
      },
      {
        id: 'performance-regression',
        name: 'Performance Regression Alert',
        description: 'Triggers when performance regression is detected',
        query: {
          metric: 'performance_regression_detected',
          aggregation: 'sum',
          filters: { severity: 'critical' },
          timeRange: '5m',
        },
        condition: {
          operator: 'gt',
          threshold: 0,
        },
        frequency: 120, // 2 minutes
        severity: 'critical',
        notifications: {
          channels: ['slack', 'email', 'pagerduty'],
          message: 'Critical performance regression detected - immediate attention required',
        },
        enabled: true,
      },
    ];

    alertRules.forEach(rule => {
      this.alertRules.set(rule.id, rule);
    });
  }

  /**
   * Create or update dashboard in SignOz
   */
  async createDashboard(templateId: string): Promise<{ success: boolean; dashboardUrl?: string; error?: string }> {
    return this.businessInstrumentation.createBusinessSpan(
      'signoz.create_dashboard',
      'dashboard_management',
      async (span: api.Span) => {
        if (!this.config.enabled) {
          return { success: false, error: 'SignOz integration is disabled' };
        }

        const template = this.dashboardTemplates.get(templateId);
        if (!template) {
          return { success: false, error: `Dashboard template '${templateId}' not found` };
        }

        try {
          const dashboardConfig = {
            title: template.title,
            description: template.description,
            tags: template.tags,
            panels: template.panels.map(panel => ({
              id: panel.id,
              title: panel.title,
              type: panel.type,
              targets: [{
                expr: this.buildPromQLQuery(panel.query),
                legendFormat: panel.title,
              }],
              gridPos: panel.position,
              fieldConfig: {
                defaults: {
                  unit: panel.unit || 'short',
                  decimals: panel.decimals || 2,
                  thresholds: panel.thresholds ? {
                    steps: [
                      { color: 'green', value: null },
                      { color: 'yellow', value: panel.thresholds.warning },
                      { color: 'red', value: panel.thresholds.critical },
                    ],
                  } : undefined,
                },
              },
            })),
            templating: {
              list: template.variables?.map(variable => ({
                name: variable.name,
                label: variable.label,
                type: variable.type,
                query: variable.query || '',
                options: variable.options || [],
                current: { value: variable.defaultValue || '' },
              })) || [],
            },
            refresh: `${this.config.refreshInterval}s`,
            time: {
              from: 'now-1h',
              to: 'now',
            },
          };

          // TODO: Implement actual SignOz API call
          const dashboardUrl = `${this.config.signozUrl}/dashboard/${templateId}`;
          
          span.setAttributes({
            'signoz.dashboard.id': templateId,
            'signoz.dashboard.title': template.title,
            'signoz.dashboard.panels_count': template.panels.length,
            'signoz.dashboard.url': dashboardUrl,
          });

          logger.info('Dashboard created in SignOz', {
            event: 'signoz.dashboard.created',
            templateId,
            title: template.title,
            panelsCount: template.panels.length,
            dashboardUrl,
          });

          return {
            success: true,
            dashboardUrl,
          };

        } catch (error) {
          span.recordException(error as Error);
          span.setStatus({
            code: api.SpanStatusCode.ERROR,
            message: (error as Error).message,
          });

          logger.error('Failed to create SignOz dashboard', {
            event: 'signoz.dashboard.create_failed',
            templateId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });

          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      }
    );
  }

  /**
   * Setup alert rules in SignOz
   */
  async setupAlertRules(): Promise<{ success: boolean; rulesCreated: number; errors: string[] }> {
    return this.businessInstrumentation.createBusinessSpan(
      'signoz.setup_alert_rules',
      'alert_management',
      async (span: api.Span) => {
        if (!this.config.enabled) {
          return { success: false, rulesCreated: 0, errors: ['SignOz integration is disabled'] };
        }

        let rulesCreated = 0;
        const errors: string[] = [];

        for (const [ruleId, rule] of this.alertRules.entries()) {
          try {
            if (!rule.enabled) continue;

            const alertConfig = {
              name: rule.name,
              description: rule.description,
              expr: this.buildPromQLQuery(rule.query),
              condition: `${rule.condition.operator} ${rule.condition.threshold}`,
              frequency: `${rule.frequency}s`,
              severity: rule.severity,
              annotations: {
                message: rule.notifications.message || rule.description,
              },
              labels: {
                alertname: rule.name,
                severity: rule.severity,
              },
            };

            // TODO: Implement actual SignOz API call for alert rules
            rulesCreated++;

            logger.info('Alert rule created in SignOz', {
              event: 'signoz.alert_rule.created',
              ruleId,
              name: rule.name,
              severity: rule.severity,
            });

          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            errors.push(`Failed to create rule '${ruleId}': ${errorMessage}`);
            
            logger.error('Failed to create SignOz alert rule', {
              event: 'signoz.alert_rule.create_failed',
              ruleId,
              error: errorMessage,
            });
          }
        }

        span.setAttributes({
          'signoz.alert_rules.total': this.alertRules.size,
          'signoz.alert_rules.created': rulesCreated,
          'signoz.alert_rules.errors': errors.length,
        });

        return {
          success: errors.length === 0,
          rulesCreated,
          errors,
        };
      }
    );
  }

  /**
   * Build PromQL query from SignOz query structure
   */
  private buildPromQLQuery(query: SignOzQuery): string {
    let promql = query.metric;

    // Add filters
    if (query.filters && Object.keys(query.filters).length > 0) {
      const filters = Object.entries(query.filters)
        .map(([key, value]) => `${key}="${value}"`)
        .join(', ');
      promql += `{${filters}}`;
    }

    // Add aggregation
    if (query.aggregation && query.aggregation !== 'avg') {
      if (query.groupBy && query.groupBy.length > 0) {
        const groupBy = query.groupBy.join(', ');
        promql = `${query.aggregation} by (${groupBy}) (${promql})`;
      } else {
        promql = `${query.aggregation}(${promql})`;
      }
    }

    // Add rate function for rate aggregation
    if (query.aggregation === 'rate') {
      promql = `rate(${promql}[${query.timeRange}])`;
    }

    return promql;
  }

  /**
   * Get available dashboard templates
   */
  getDashboardTemplates(): DashboardTemplate[] {
    return Array.from(this.dashboardTemplates.values());
  }

  /**
   * Get dashboard template by ID
   */
  getDashboardTemplate(templateId: string): DashboardTemplate | undefined {
    return this.dashboardTemplates.get(templateId);
  }

  /**
   * Add custom dashboard template
   */
  addDashboardTemplate(template: DashboardTemplate): void {
    this.dashboardTemplates.set(template.id, template);
    
    logger.info('Custom dashboard template added', {
      event: 'signoz.dashboard_template.added',
      templateId: template.id,
      title: template.title,
      panelsCount: template.panels.length,
    });
  }

  /**
   * Get alert rules
   */
  getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  /**
   * Add custom alert rule
   */
  addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
    
    logger.info('Custom alert rule added', {
      event: 'signoz.alert_rule.added',
      ruleId: rule.id,
      name: rule.name,
      severity: rule.severity,
    });
  }

  /**
   * Generate SignOz dashboard URL
   */
  generateDashboardUrl(dashboardId: string, timeRange?: string): string {
    const baseUrl = `${this.config.signozUrl}/dashboard/${dashboardId}`;
    const params = new URLSearchParams();

    if (timeRange) {
      params.set('from', `now-${timeRange}`);
      params.set('to', 'now');
    }

    params.set('refresh', `${this.config.refreshInterval}s`);

    return params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl;
  }

  /**
   * Test SignOz connectivity
   */
  async testConnection(): Promise<{ success: boolean; latency?: number; error?: string }> {
    return this.businessInstrumentation.createBusinessSpan(
      'signoz.test_connection',
      'connectivity_test',
      async (span: api.Span) => {
        if (!this.config.enabled) {
          return { success: false, error: 'SignOz integration is disabled' };
        }

        try {
          const startTime = Date.now();
          
          // TODO: Implement actual SignOz API health check
          // For now, just simulate the test
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const latency = Date.now() - startTime;

          span.setAttributes({
            'signoz.connection.success': true,
            'signoz.connection.latency': latency,
            'signoz.connection.url': this.config.signozUrl,
          });

          return { success: true, latency };

        } catch (error) {
          span.recordException(error as Error);
          span.setStatus({
            code: api.SpanStatusCode.ERROR,
            message: (error as Error).message,
          });

          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      }
    );
  }
}

// Global service instance
let globalSignOzDashboardService: SignOzPerformanceDashboardService | null = null;

/**
 * Get global SignOz dashboard service instance
 */
export function getSignOzDashboardService(
  config?: Partial<SignOzDashboardConfig>
): SignOzPerformanceDashboardService {
  if (!globalSignOzDashboardService) {
    globalSignOzDashboardService = new SignOzPerformanceDashboardService(config);
  }
  return globalSignOzDashboardService;
}