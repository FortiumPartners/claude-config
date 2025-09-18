/**
 * Task 6.5: Operational Dashboards System
 * Helm Chart Specialist - Sprint 6 Observability Implementation
 *
 * Comprehensive dashboard suite with Grafana integration, role-based access,
 * real-time visualizations, mobile-responsive design, and dashboard-as-code
 */

const express = require('express');
const axios = require('axios');
const winston = require('winston');
const crypto = require('crypto');
const { EventEmitter } = require('events');

class HelmChartDashboardManager extends EventEmitter {
    constructor(options = {}) {
        super();

        this.config = {
            grafanaUrl: options.grafanaUrl || 'http://grafana:3000',
            grafanaUsername: options.grafanaUsername || 'admin',
            grafanaPassword: options.grafanaPassword || 'admin',
            prometheusUrl: options.prometheusUrl || 'http://prometheus:9090',
            elasticsearchUrl: options.elasticsearchUrl || 'http://elasticsearch:9200',
            jaegerUrl: options.jaegerUrl || 'http://jaeger-query:16686',
            enableRoleBasedAccess: options.enableRoleBasedAccess !== false,
            enableMobileOptimization: options.enableMobileOptimization !== false,
            enableDashboardVersioning: options.enableDashboardVersioning !== false,
            refreshInterval: options.refreshInterval || 30000, // 30 seconds
            ...options
        };

        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.Console(),
                new winston.transports.File({ filename: '/var/log/dashboard-manager.log' })
            ]
        });

        // Dashboard definitions and state
        this.dashboards = new Map();
        this.userRoles = new Map();
        this.dashboardVersions = new Map();

        // Initialize Grafana client
        this.initializeGrafanaClient();
        this.initializeDashboardDefinitions();
        this.initializeRoleBasedAccess();

        if (this.config.enableDashboardVersioning) {
            this.initializeDashboardVersioning();
        }

        this.logger.info('Helm Chart Dashboard Manager initialized', {
            grafanaUrl: this.config.grafanaUrl,
            enableRoleBasedAccess: this.config.enableRoleBasedAccess,
            dashboardCount: this.dashboards.size
        });
    }

    /**
     * Initialize Grafana API client
     */
    initializeGrafanaClient() {
        this.grafanaClient = axios.create({
            baseURL: this.config.grafanaUrl,
            auth: {
                username: this.config.grafanaUsername,
                password: this.config.grafanaPassword
            },
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // Test connection
        this.grafanaClient.get('/api/health')
            .then(() => {
                this.logger.info('Connected to Grafana successfully');
            })
            .catch(error => {
                this.logger.error('Failed to connect to Grafana', { error: error.message });
            });
    }

    /**
     * Initialize comprehensive dashboard definitions
     */
    initializeDashboardDefinitions() {
        // Executive Overview Dashboard
        this.dashboards.set('executive-overview', {
            id: 'executive-overview',
            title: 'Helm Chart Specialist - Executive Overview',
            description: 'High-level business metrics and KPIs',
            roles: ['executive', 'manager', 'admin'],
            tags: ['business', 'kpi', 'overview'],
            definition: this.createExecutiveOverviewDashboard()
        });

        // Operations Dashboard
        this.dashboards.set('operations-dashboard', {
            id: 'operations-dashboard',
            title: 'Helm Chart Operations',
            description: 'Real-time operational metrics and alerts',
            roles: ['operator', 'sre', 'admin'],
            tags: ['operations', 'monitoring', 'alerts'],
            definition: this.createOperationsDashboard()
        });

        // Development Dashboard
        this.dashboards.set('development-dashboard', {
            id: 'development-dashboard',
            title: 'Development Metrics',
            description: 'Developer-focused metrics and performance',
            roles: ['developer', 'tech-lead', 'admin'],
            tags: ['development', 'performance', 'debugging'],
            definition: this.createDevelopmentDashboard()
        });

        // Security Dashboard
        this.dashboards.set('security-dashboard', {
            id: 'security-dashboard',
            title: 'Security Monitoring',
            description: 'Security events, vulnerabilities, and compliance',
            roles: ['security', 'admin'],
            tags: ['security', 'compliance', 'vulnerabilities'],
            definition: this.createSecurityDashboard()
        });

        // Performance Dashboard
        this.dashboards.set('performance-dashboard', {
            id: 'performance-dashboard',
            title: 'Performance Analytics',
            description: 'Detailed performance metrics and optimization',
            roles: ['performance-engineer', 'sre', 'admin'],
            tags: ['performance', 'optimization', 'analytics'],
            definition: this.createPerformanceDashboard()
        });

        // Business Analytics Dashboard
        this.dashboards.set('business-analytics', {
            id: 'business-analytics',
            title: 'Business Analytics',
            description: 'User behavior, feature adoption, and business impact',
            roles: ['product-manager', 'analyst', 'admin'],
            tags: ['business', 'analytics', 'adoption'],
            definition: this.createBusinessAnalyticsDashboard()
        });

        // Mobile Operations Dashboard
        this.dashboards.set('mobile-operations', {
            id: 'mobile-operations',
            title: 'Mobile Operations',
            description: 'Mobile-optimized operational view',
            roles: ['operator', 'sre', 'on-call'],
            tags: ['mobile', 'operations', 'on-call'],
            definition: this.createMobileOperationsDashboard()
        });
    }

    /**
     * Create Executive Overview Dashboard
     */
    createExecutiveOverviewDashboard() {
        return {
            dashboard: {
                id: null,
                title: 'Helm Chart Specialist - Executive Overview',
                description: 'Executive-level overview of Helm Chart Specialist performance and business impact',
                tags: ['business', 'kpi', 'executive'],
                timezone: 'browser',
                refresh: '1m',
                time: {
                    from: 'now-24h',
                    to: 'now'
                },
                panels: [
                    {
                        id: 1,
                        title: 'Productivity Improvement',
                        type: 'stat',
                        targets: [{
                            expr: 'helm_productivity_improvement_percentage',
                            refId: 'A'
                        }],
                        fieldConfig: {
                            defaults: {
                                unit: 'percent',
                                color: { mode: 'value' },
                                mappings: [{
                                    options: {
                                        from: 60,
                                        to: 100
                                    },
                                    result: {
                                        color: 'green'
                                    }
                                }],
                                thresholds: {
                                    steps: [
                                        { color: 'red', value: null },
                                        { color: 'yellow', value: 40 },
                                        { color: 'green', value: 60 }
                                    ]
                                }
                            }
                        },
                        gridPos: { h: 8, w: 6, x: 0, y: 0 }
                    },
                    {
                        id: 2,
                        title: 'Deployment Success Rate',
                        type: 'stat',
                        targets: [{
                            expr: 'rate(helm_deployment_total{status="success"}[24h]) / rate(helm_deployment_total[24h]) * 100',
                            refId: 'A'
                        }],
                        fieldConfig: {
                            defaults: {
                                unit: 'percent',
                                thresholds: {
                                    steps: [
                                        { color: 'red', value: null },
                                        { color: 'yellow', value: 90 },
                                        { color: 'green', value: 95 }
                                    ]
                                }
                            }
                        },
                        gridPos: { h: 8, w: 6, x: 6, y: 0 }
                    },
                    {
                        id: 3,
                        title: 'Time to Deployment',
                        type: 'stat',
                        targets: [{
                            expr: 'histogram_quantile(0.95, rate(helm_time_to_deployment_minutes_bucket[24h]))',
                            refId: 'A'
                        }],
                        fieldConfig: {
                            defaults: {
                                unit: 'min',
                                thresholds: {
                                    steps: [
                                        { color: 'green', value: null },
                                        { color: 'yellow', value: 30 },
                                        { color: 'red', value: 60 }
                                    ]
                                }
                            }
                        },
                        gridPos: { h: 8, w: 6, x: 12, y: 0 }
                    },
                    {
                        id: 4,
                        title: 'User Satisfaction',
                        type: 'stat',
                        targets: [{
                            expr: 'avg(helm_user_satisfaction_score)',
                            refId: 'A'
                        }],
                        fieldConfig: {
                            defaults: {
                                unit: 'short',
                                decimals: 1,
                                thresholds: {
                                    steps: [
                                        { color: 'red', value: null },
                                        { color: 'yellow', value: 3.5 },
                                        { color: 'green', value: 4.0 }
                                    ]
                                }
                            }
                        },
                        gridPos: { h: 8, w: 6, x: 18, y: 0 }
                    },
                    {
                        id: 5,
                        title: 'Daily Chart Generation Trend',
                        type: 'timeseries',
                        targets: [{
                            expr: 'rate(helm_chart_generation_total[1h]) * 3600',
                            refId: 'A',
                            legendFormat: 'Charts per hour'
                        }],
                        fieldConfig: {
                            defaults: {
                                unit: 'short',
                                custom: {
                                    drawStyle: 'line',
                                    lineInterpolation: 'smooth'
                                }
                            }
                        },
                        gridPos: { h: 8, w: 12, x: 0, y: 8 }
                    },
                    {
                        id: 6,
                        title: 'Cost Savings',
                        type: 'stat',
                        targets: [{
                            expr: 'helm_cost_savings_dollars_total',
                            refId: 'A'
                        }],
                        fieldConfig: {
                            defaults: {
                                unit: 'currencyUSD',
                                color: { mode: 'value' },
                                thresholds: {
                                    steps: [
                                        { color: 'green', value: null }
                                    ]
                                }
                            }
                        },
                        gridPos: { h: 8, w: 12, x: 12, y: 8 }
                    }
                ]
            }
        };
    }

    /**
     * Create Operations Dashboard
     */
    createOperationsDashboard() {
        return {
            dashboard: {
                id: null,
                title: 'Helm Chart Operations',
                description: 'Real-time operational monitoring and alerting',
                tags: ['operations', 'monitoring'],
                timezone: 'browser',
                refresh: '30s',
                time: {
                    from: 'now-1h',
                    to: 'now'
                },
                panels: [
                    {
                        id: 1,
                        title: 'Active Alerts',
                        type: 'alertlist',
                        targets: [],
                        options: {
                            showOptions: 'current',
                            maxItems: 20,
                            sortOrder: 1
                        },
                        gridPos: { h: 8, w: 12, x: 0, y: 0 }
                    },
                    {
                        id: 2,
                        title: 'Chart Generation Rate',
                        type: 'timeseries',
                        targets: [{
                            expr: 'rate(helm_chart_generation_total[5m])',
                            refId: 'A',
                            legendFormat: '{{chart_type}}'
                        }],
                        gridPos: { h: 8, w: 12, x: 12, y: 0 }
                    },
                    {
                        id: 3,
                        title: 'Deployment Status',
                        type: 'piechart',
                        targets: [{
                            expr: 'sum by (status) (rate(helm_deployment_total[1h]))',
                            refId: 'A'
                        }],
                        gridPos: { h: 8, w: 8, x: 0, y: 8 }
                    },
                    {
                        id: 4,
                        title: 'Response Time Distribution',
                        type: 'heatmap',
                        targets: [{
                            expr: 'rate(helm_chart_generation_duration_seconds_bucket[5m])',
                            refId: 'A'
                        }],
                        gridPos: { h: 8, w: 16, x: 8, y: 8 }
                    }
                ]
            }
        };
    }

    /**
     * Create Development Dashboard
     */
    createDevelopmentDashboard() {
        return {
            dashboard: {
                id: null,
                title: 'Development Metrics',
                description: 'Developer-focused performance and debugging metrics',
                tags: ['development', 'performance'],
                timezone: 'browser',
                refresh: '1m',
                panels: [
                    {
                        id: 1,
                        title: 'Error Rate by Operation',
                        type: 'timeseries',
                        targets: [{
                            expr: 'rate(helm_chart_generation_total{status="failure"}[5m]) by (operation)',
                            refId: 'A'
                        }],
                        gridPos: { h: 8, w: 12, x: 0, y: 0 }
                    },
                    {
                        id: 2,
                        title: 'Memory Usage',
                        type: 'timeseries',
                        targets: [{
                            expr: 'helm_memory_usage_bytes / 1024 / 1024',
                            refId: 'A',
                            legendFormat: 'Memory MB'
                        }],
                        gridPos: { h: 8, w: 12, x: 12, y: 0 }
                    },
                    {
                        id: 3,
                        title: 'Top Slow Operations',
                        type: 'table',
                        targets: [{
                            expr: 'topk(10, histogram_quantile(0.95, rate(helm_chart_generation_duration_seconds_bucket[1h])) by (operation))',
                            refId: 'A'
                        }],
                        gridPos: { h: 8, w: 24, x: 0, y: 8 }
                    }
                ]
            }
        };
    }

    /**
     * Create Security Dashboard
     */
    createSecurityDashboard() {
        return {
            dashboard: {
                id: null,
                title: 'Security Monitoring',
                description: 'Security events, vulnerabilities, and compliance monitoring',
                tags: ['security', 'compliance'],
                timezone: 'browser',
                refresh: '30s',
                panels: [
                    {
                        id: 1,
                        title: 'Critical Vulnerabilities',
                        type: 'stat',
                        targets: [{
                            expr: 'sum(helm_security_vulnerabilities_total{severity="critical"})',
                            refId: 'A'
                        }],
                        fieldConfig: {
                            defaults: {
                                color: { mode: 'thresholds' },
                                thresholds: {
                                    steps: [
                                        { color: 'green', value: null },
                                        { color: 'red', value: 1 }
                                    ]
                                }
                            }
                        },
                        gridPos: { h: 8, w: 6, x: 0, y: 0 }
                    },
                    {
                        id: 2,
                        title: 'Security Events Timeline',
                        type: 'timeseries',
                        targets: [{
                            expr: 'rate(helm_audit_events_total[5m]) by (event_type)',
                            refId: 'A'
                        }],
                        gridPos: { h: 8, w: 18, x: 6, y: 0 }
                    },
                    {
                        id: 3,
                        title: 'Policy Compliance',
                        type: 'gauge',
                        targets: [{
                            expr: 'helm_policy_compliance_percentage',
                            refId: 'A'
                        }],
                        fieldConfig: {
                            defaults: {
                                unit: 'percent',
                                min: 0,
                                max: 100,
                                thresholds: {
                                    steps: [
                                        { color: 'red', value: 0 },
                                        { color: 'yellow', value: 90 },
                                        { color: 'green', value: 95 }
                                    ]
                                }
                            }
                        },
                        gridPos: { h: 8, w: 12, x: 0, y: 8 }
                    }
                ]
            }
        };
    }

    /**
     * Create Performance Dashboard
     */
    createPerformanceDashboard() {
        return {
            dashboard: {
                id: null,
                title: 'Performance Analytics',
                description: 'Detailed performance metrics and optimization insights',
                tags: ['performance', 'optimization'],
                timezone: 'browser',
                refresh: '1m',
                panels: [
                    {
                        id: 1,
                        title: 'Latency Percentiles',
                        type: 'timeseries',
                        targets: [
                            {
                                expr: 'histogram_quantile(0.50, rate(helm_chart_generation_duration_seconds_bucket[5m]))',
                                refId: 'A',
                                legendFormat: 'p50'
                            },
                            {
                                expr: 'histogram_quantile(0.95, rate(helm_chart_generation_duration_seconds_bucket[5m]))',
                                refId: 'B',
                                legendFormat: 'p95'
                            },
                            {
                                expr: 'histogram_quantile(0.99, rate(helm_chart_generation_duration_seconds_bucket[5m]))',
                                refId: 'C',
                                legendFormat: 'p99'
                            }
                        ],
                        gridPos: { h: 8, w: 12, x: 0, y: 0 }
                    },
                    {
                        id: 2,
                        title: 'Cache Hit Rate',
                        type: 'timeseries',
                        targets: [{
                            expr: 'helm_cache_hit_rate * 100',
                            refId: 'A',
                            legendFormat: 'Hit Rate %'
                        }],
                        gridPos: { h: 8, w: 12, x: 12, y: 0 }
                    },
                    {
                        id: 3,
                        title: 'Resource Utilization',
                        type: 'timeseries',
                        targets: [
                            {
                                expr: 'helm_cpu_usage_percentage',
                                refId: 'A',
                                legendFormat: 'CPU %'
                            },
                            {
                                expr: 'helm_memory_usage_bytes / 1024 / 1024 / 1024',
                                refId: 'B',
                                legendFormat: 'Memory GB'
                            }
                        ],
                        gridPos: { h: 8, w: 24, x: 0, y: 8 }
                    }
                ]
            }
        };
    }

    /**
     * Create Business Analytics Dashboard
     */
    createBusinessAnalyticsDashboard() {
        return {
            dashboard: {
                id: null,
                title: 'Business Analytics',
                description: 'Feature adoption, user behavior, and business impact metrics',
                tags: ['business', 'analytics'],
                timezone: 'browser',
                refresh: '5m',
                panels: [
                    {
                        id: 1,
                        title: 'Feature Adoption Rate',
                        type: 'piechart',
                        targets: [{
                            expr: 'sum by (feature) (rate(helm_feature_usage_total[24h]))',
                            refId: 'A'
                        }],
                        gridPos: { h: 8, w: 12, x: 0, y: 0 }
                    },
                    {
                        id: 2,
                        title: 'User Onboarding Time',
                        type: 'histogram',
                        targets: [{
                            expr: 'helm_user_onboarding_duration_minutes_bucket',
                            refId: 'A'
                        }],
                        gridPos: { h: 8, w: 12, x: 12, y: 0 }
                    },
                    {
                        id: 3,
                        title: 'ROI Trend',
                        type: 'timeseries',
                        targets: [{
                            expr: 'helm_roi_percentage',
                            refId: 'A',
                            legendFormat: 'ROI %'
                        }],
                        gridPos: { h: 8, w: 24, x: 0, y: 8 }
                    }
                ]
            }
        };
    }

    /**
     * Create Mobile Operations Dashboard
     */
    createMobileOperationsDashboard() {
        return {
            dashboard: {
                id: null,
                title: 'Mobile Operations',
                description: 'Mobile-optimized operational dashboard for on-call',
                tags: ['mobile', 'operations'],
                timezone: 'browser',
                refresh: '30s',
                panels: [
                    {
                        id: 1,
                        title: 'System Health',
                        type: 'stat',
                        targets: [{
                            expr: '(sum(up{job="helm-chart-specialist"}) / count(up{job="helm-chart-specialist"})) * 100',
                            refId: 'A'
                        }],
                        fieldConfig: {
                            defaults: {
                                unit: 'percent',
                                thresholds: {
                                    steps: [
                                        { color: 'red', value: null },
                                        { color: 'yellow', value: 90 },
                                        { color: 'green', value: 99 }
                                    ]
                                }
                            }
                        },
                        gridPos: { h: 4, w: 12, x: 0, y: 0 }
                    },
                    {
                        id: 2,
                        title: 'Active Incidents',
                        type: 'stat',
                        targets: [{
                            expr: 'sum(ALERTS{alertstate="firing"})',
                            refId: 'A'
                        }],
                        fieldConfig: {
                            defaults: {
                                color: { mode: 'thresholds' },
                                thresholds: {
                                    steps: [
                                        { color: 'green', value: null },
                                        { color: 'yellow', value: 1 },
                                        { color: 'red', value: 3 }
                                    ]
                                }
                            }
                        },
                        gridPos: { h: 4, w: 12, x: 12, y: 0 }
                    }
                ]
            }
        };
    }

    /**
     * Initialize role-based access control
     */
    initializeRoleBasedAccess() {
        if (!this.config.enableRoleBasedAccess) return;

        // Define user roles and their permissions
        this.userRoles.set('executive', {
            name: 'Executive',
            permissions: ['view'],
            dashboards: ['executive-overview', 'business-analytics'],
            dataRetention: '30d'
        });

        this.userRoles.set('manager', {
            name: 'Manager',
            permissions: ['view', 'annotate'],
            dashboards: ['executive-overview', 'operations-dashboard', 'business-analytics'],
            dataRetention: '7d'
        });

        this.userRoles.set('developer', {
            name: 'Developer',
            permissions: ['view', 'annotate', 'edit'],
            dashboards: ['development-dashboard', 'performance-dashboard'],
            dataRetention: '24h'
        });

        this.userRoles.set('sre', {
            name: 'Site Reliability Engineer',
            permissions: ['view', 'annotate', 'edit'],
            dashboards: ['operations-dashboard', 'performance-dashboard', 'mobile-operations'],
            dataRetention: '1h'
        });

        this.userRoles.set('security', {
            name: 'Security Engineer',
            permissions: ['view', 'annotate'],
            dashboards: ['security-dashboard'],
            dataRetention: '1h'
        });

        this.userRoles.set('admin', {
            name: 'Administrator',
            permissions: ['view', 'annotate', 'edit', 'admin'],
            dashboards: ['*'],
            dataRetention: '1m'
        });

        this.logger.info('Role-based access control initialized', {
            roles: Array.from(this.userRoles.keys())
        });
    }

    /**
     * Initialize dashboard versioning
     */
    initializeDashboardVersioning() {
        this.dashboardVersions.set('current', new Map());
        this.dashboardVersions.set('history', new Map());

        this.logger.info('Dashboard versioning initialized');
    }

    /**
     * Deploy dashboard to Grafana
     */
    async deployDashboard(dashboardId, options = {}) {
        const dashboard = this.dashboards.get(dashboardId);
        if (!dashboard) {
            throw new Error(`Dashboard ${dashboardId} not found`);
        }

        try {
            // Create or update datasources first
            await this.ensureDataSources();

            // Deploy dashboard
            const response = await this.grafanaClient.post('/api/dashboards/db', {
                dashboard: dashboard.definition.dashboard,
                overwrite: options.overwrite || true,
                message: options.message || `Deploy ${dashboard.title}`,
                folderId: options.folderId || 0
            });

            // Store version if versioning is enabled
            if (this.config.enableDashboardVersioning) {
                this.storeDashboardVersion(dashboardId, dashboard.definition, response.data);
            }

            this.logger.info('Dashboard deployed successfully', {
                dashboardId,
                uid: response.data.uid,
                url: response.data.url
            });

            return response.data;

        } catch (error) {
            this.logger.error('Failed to deploy dashboard', {
                dashboardId,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Deploy all dashboards
     */
    async deployAllDashboards(options = {}) {
        const results = [];

        for (const [dashboardId, dashboard] of this.dashboards) {
            try {
                const result = await this.deployDashboard(dashboardId, options);
                results.push({ dashboardId, status: 'success', result });
            } catch (error) {
                results.push({ dashboardId, status: 'error', error: error.message });
            }
        }

        return results;
    }

    /**
     * Ensure required data sources exist in Grafana
     */
    async ensureDataSources() {
        const dataSources = [
            {
                name: 'Prometheus',
                type: 'prometheus',
                url: this.config.prometheusUrl,
                access: 'proxy',
                isDefault: true
            },
            {
                name: 'Elasticsearch',
                type: 'elasticsearch',
                url: this.config.elasticsearchUrl,
                access: 'proxy',
                database: 'helm-chart-specialist-*',
                interval: 'Daily',
                timeField: '@timestamp'
            },
            {
                name: 'Jaeger',
                type: 'jaeger',
                url: this.config.jaegerUrl,
                access: 'proxy'
            }
        ];

        for (const dataSource of dataSources) {
            try {
                // Check if data source exists
                const existingResponse = await this.grafanaClient.get(`/api/datasources/name/${dataSource.name}`);

                // Update if exists
                await this.grafanaClient.put(`/api/datasources/${existingResponse.data.id}`, {
                    ...existingResponse.data,
                    ...dataSource
                });

                this.logger.info('Data source updated', { name: dataSource.name });

            } catch (error) {
                if (error.response?.status === 404) {
                    // Create new data source
                    await this.grafanaClient.post('/api/datasources', dataSource);
                    this.logger.info('Data source created', { name: dataSource.name });
                } else {
                    this.logger.error('Failed to ensure data source', {
                        name: dataSource.name,
                        error: error.message
                    });
                }
            }
        }
    }

    /**
     * Get dashboards accessible to user role
     */
    getUserDashboards(userRole) {
        const role = this.userRoles.get(userRole);
        if (!role) {
            return [];
        }

        const accessibleDashboards = [];

        for (const [dashboardId, dashboard] of this.dashboards) {
            if (role.dashboards.includes('*') || role.dashboards.includes(dashboardId)) {
                accessibleDashboards.push({
                    id: dashboardId,
                    title: dashboard.title,
                    description: dashboard.description,
                    tags: dashboard.tags,
                    permissions: role.permissions
                });
            }
        }

        return accessibleDashboards;
    }

    /**
     * Create custom dashboard for specific use case
     */
    async createCustomDashboard(definition, userRole) {
        const role = this.userRoles.get(userRole);
        if (!role || !role.permissions.includes('edit')) {
            throw new Error('Insufficient permissions to create dashboard');
        }

        const dashboardId = `custom-${crypto.randomBytes(8).toString('hex')}`;

        this.dashboards.set(dashboardId, {
            id: dashboardId,
            title: definition.title,
            description: definition.description,
            roles: [userRole],
            tags: [...(definition.tags || []), 'custom'],
            definition: definition,
            creator: userRole,
            created: new Date().toISOString()
        });

        // Deploy to Grafana
        const result = await this.deployDashboard(dashboardId);

        this.logger.info('Custom dashboard created', {
            dashboardId,
            userRole,
            title: definition.title
        });

        return { dashboardId, ...result };
    }

    /**
     * Store dashboard version for versioning
     */
    storeDashboardVersion(dashboardId, definition, deployResult) {
        const currentVersions = this.dashboardVersions.get('current');
        const history = this.dashboardVersions.get('history');

        // Move current to history
        if (currentVersions.has(dashboardId)) {
            const historyList = history.get(dashboardId) || [];
            historyList.push({
                version: currentVersions.get(dashboardId),
                timestamp: new Date().toISOString()
            });
            history.set(dashboardId, historyList);
        }

        // Store new current version
        currentVersions.set(dashboardId, {
            definition,
            deployResult,
            version: deployResult.version,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Dashboard management API
     */
    getDashboardAPI() {
        const router = express.Router();

        // Get user dashboards
        router.get('/dashboards/:userRole', (req, res) => {
            try {
                const dashboards = this.getUserDashboards(req.params.userRole);
                res.json({ dashboards });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Deploy dashboard
        router.post('/dashboards/:dashboardId/deploy', async (req, res) => {
            try {
                const result = await this.deployDashboard(req.params.dashboardId, req.body);
                res.json(result);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Create custom dashboard
        router.post('/dashboards/custom', async (req, res) => {
            try {
                const result = await this.createCustomDashboard(req.body.definition, req.body.userRole);
                res.json(result);
            } catch (error) {
                res.status(400).json({ error: error.message });
            }
        });

        // Get dashboard definition
        router.get('/dashboards/:dashboardId/definition', (req, res) => {
            const dashboard = this.dashboards.get(req.params.dashboardId);
            if (!dashboard) {
                return res.status(404).json({ error: 'Dashboard not found' });
            }
            res.json(dashboard);
        });

        // Health check
        router.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                dashboards: this.dashboards.size,
                roles: this.userRoles.size,
                grafanaUrl: this.config.grafanaUrl
            });
        });

        return router;
    }
}

// Export for integration
module.exports = {
    HelmChartDashboardManager,

    // Factory function
    createDashboardManager: (options) => new HelmChartDashboardManager(options),

    // User roles
    UserRoles: {
        EXECUTIVE: 'executive',
        MANAGER: 'manager',
        DEVELOPER: 'developer',
        SRE: 'sre',
        SECURITY: 'security',
        ADMIN: 'admin'
    }
};

/**
 * Example Usage:
 *
 * const { createDashboardManager, UserRoles } = require('./operational-dashboards');
 *
 * const dashboardManager = createDashboardManager({
 *     grafanaUrl: 'http://grafana:3000',
 *     prometheusUrl: 'http://prometheus:9090',
 *     enableRoleBasedAccess: true
 * });
 *
 * // Deploy all dashboards
 * await dashboardManager.deployAllDashboards();
 *
 * // Get dashboards for a specific role
 * const dashboards = dashboardManager.getUserDashboards(UserRoles.SRE);
 */