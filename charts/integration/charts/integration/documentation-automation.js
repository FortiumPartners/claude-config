#!/usr/bin/env node

/**
 * Documentation Automation for Helm Chart Specialist
 * 
 * This module implements comprehensive documentation automation including:
 * - README generation from templates and values configurations
 * - Values documentation extraction with descriptions and examples
 * - Usage examples generation for different deployment scenarios
 * - Troubleshooting guides with common issues and solutions
 * - API documentation for chart interfaces and integrations
 * 
 * @version 1.0.0
 * @author Documentation Specialist Agent (delegated by Tech Lead Orchestrator)
 * @integrates template-engine.js and multi-application-support.js for comprehensive docs
 */

const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

class DocumentationAutomation {
    constructor() {
        this.documentationTemplates = new Map();
        this.exampleScenarios = new Map();
        this.troubleshootingGuides = new Map();
        this.apiDocumentation = new Map();
        
        this.initializeDocumentationTemplates();
        this.initializeExampleScenarios();
        this.initializeTroubleshootingGuides();
        this.initializeApiDocumentation();
    }

    /**
     * Initialize documentation templates
     */
    initializeDocumentationTemplates() {
        this.documentationTemplates.set('readme', {
            sections: [
                'title',
                'description',
                'prerequisites',
                'installation',
                'configuration',
                'usage',
                'examples',
                'troubleshooting',
                'contributing',
                'license'
            ],
            format: 'markdown'
        });

        this.documentationTemplates.set('values', {
            sections: [
                'overview',
                'global-configuration',
                'application-configuration',
                'networking-configuration',
                'storage-configuration',
                'monitoring-configuration',
                'security-configuration'
            ],
            format: 'markdown'
        });

        this.documentationTemplates.set('api', {
            sections: [
                'endpoints',
                'authentication',
                'request-format',
                'response-format',
                'error-handling',
                'rate-limiting',
                'examples'
            ],
            format: 'openapi'
        });

        this.documentationTemplates.set('troubleshooting', {
            sections: [
                'common-issues',
                'deployment-issues',
                'configuration-issues',
                'performance-issues',
                'security-issues',
                'debugging-guide'
            ],
            format: 'markdown'
        });
    }

    /**
     * Initialize example scenarios
     */
    initializeExampleScenarios() {
        this.exampleScenarios.set('basic-deployment', {
            title: 'Basic Deployment',
            description: 'Simple deployment with minimal configuration',
            values: {
                replicaCount: 1,
                image: { repository: 'nginx', tag: '1.21', pullPolicy: 'IfNotPresent' },
                service: { type: 'ClusterIP', port: 80 }
            },
            commands: [
                'helm repo add chart-repo https://charts.example.com',
                'helm install my-app chart-repo/my-chart',
                'kubectl get pods -l app.kubernetes.io/instance=my-app'
            ]
        });

        this.exampleScenarios.set('production-deployment', {
            title: 'Production Deployment',
            description: 'Production-ready deployment with high availability',
            values: {
                replicaCount: 3,
                image: { repository: 'myapp', tag: '1.0.0', pullPolicy: 'IfNotPresent' },
                service: { type: 'ClusterIP', port: 80 },
                ingress: { 
                    enabled: true, 
                    className: 'nginx',
                    hosts: [{ host: 'myapp.example.com', paths: [{ path: '/', pathType: 'Prefix' }] }],
                    tls: [{ secretName: 'myapp-tls', hosts: ['myapp.example.com'] }]
                },
                resources: {
                    limits: { cpu: '500m', memory: '512Mi' },
                    requests: { cpu: '100m', memory: '128Mi' }
                },
                autoscaling: { enabled: true, minReplicas: 3, maxReplicas: 10 },
                monitoring: { enabled: true, serviceMonitor: { enabled: true } }
            },
            commands: [
                'helm install my-app chart-repo/my-chart -f production-values.yaml',
                'kubectl get ingress -l app.kubernetes.io/instance=my-app',
                'kubectl get hpa -l app.kubernetes.io/instance=my-app'
            ]
        });

        this.exampleScenarios.set('development-deployment', {
            title: 'Development Deployment',
            description: 'Development deployment with debugging enabled',
            values: {
                replicaCount: 1,
                image: { repository: 'myapp', tag: 'latest', pullPolicy: 'Always' },
                service: { type: 'NodePort', port: 80, nodePort: 30080 },
                env: [
                    { name: 'NODE_ENV', value: 'development' },
                    { name: 'DEBUG', value: 'true' }
                ],
                resources: {
                    limits: { cpu: '200m', memory: '256Mi' },
                    requests: { cpu: '50m', memory: '64Mi' }
                }
            },
            commands: [
                'helm install my-app-dev chart-repo/my-chart -f development-values.yaml',
                'kubectl port-forward svc/my-app-dev 8080:80',
                'curl http://localhost:8080'
            ]
        });

        this.exampleScenarios.set('multi-environment', {
            title: 'Multi-Environment Deployment',
            description: 'Deploy across development, staging, and production',
            environments: {
                development: {
                    namespace: 'dev',
                    values: { replicaCount: 1, resources: { limits: { cpu: '200m', memory: '256Mi' } } }
                },
                staging: {
                    namespace: 'staging',
                    values: { replicaCount: 2, resources: { limits: { cpu: '500m', memory: '512Mi' } } }
                },
                production: {
                    namespace: 'prod',
                    values: { replicaCount: 3, resources: { limits: { cpu: '1000m', memory: '1Gi' } } }
                }
            },
            commands: [
                'helm install my-app-dev chart-repo/my-chart -n dev -f values-dev.yaml',
                'helm install my-app-staging chart-repo/my-chart -n staging -f values-staging.yaml',
                'helm install my-app-prod chart-repo/my-chart -n prod -f values-prod.yaml'
            ]
        });
    }

    /**
     * Initialize troubleshooting guides
     */
    initializeTroubleshootingGuides() {
        this.troubleshootingGuides.set('deployment-failed', {
            title: 'Deployment Failed',
            symptoms: ['Pods stuck in Pending state', 'ImagePullBackOff errors', 'CrashLoopBackOff'],
            causes: [
                'Insufficient cluster resources',
                'Incorrect image repository or tag',
                'Application startup failures',
                'Missing secrets or configmaps'
            ],
            solutions: [
                {
                    issue: 'Insufficient resources',
                    commands: [
                        'kubectl describe nodes',
                        'kubectl top nodes',
                        'kubectl describe pod <pod-name>'
                    ],
                    fix: 'Reduce resource requests or add more nodes to the cluster'
                },
                {
                    issue: 'Image pull errors',
                    commands: [
                        'kubectl describe pod <pod-name>',
                        'kubectl get events --sort-by=.metadata.creationTimestamp'
                    ],
                    fix: 'Verify image repository, tag, and pull secrets are correct'
                },
                {
                    issue: 'Application crashes',
                    commands: [
                        'kubectl logs <pod-name>',
                        'kubectl logs <pod-name> --previous'
                    ],
                    fix: 'Check application logs for startup errors and configuration issues'
                }
            ]
        });

        this.troubleshootingGuides.set('service-unreachable', {
            title: 'Service Unreachable',
            symptoms: ['Connection timeouts', '503 Service Unavailable', 'DNS resolution failures'],
            causes: [
                'Service selector mismatch',
                'Incorrect port configuration',
                'Network policies blocking traffic',
                'Pods not ready'
            ],
            solutions: [
                {
                    issue: 'Service selector mismatch',
                    commands: [
                        'kubectl get service <service-name> -o yaml',
                        'kubectl get pods -l <selector-labels>',
                        'kubectl describe service <service-name>'
                    ],
                    fix: 'Ensure service selector labels match pod labels exactly'
                },
                {
                    issue: 'Port configuration issues',
                    commands: [
                        'kubectl get service <service-name>',
                        'kubectl get pods <pod-name> -o yaml | grep containerPort'
                    ],
                    fix: 'Verify service port and targetPort match container port'
                },
                {
                    issue: 'Network policy restrictions',
                    commands: [
                        'kubectl get networkpolicy',
                        'kubectl describe networkpolicy <policy-name>'
                    ],
                    fix: 'Review and update network policies to allow required traffic'
                }
            ]
        });

        this.troubleshootingGuides.set('ingress-not-working', {
            title: 'Ingress Not Working',
            symptoms: ['404 Not Found', 'SSL certificate errors', 'Ingress controller issues'],
            causes: [
                'Ingress class not specified',
                'Incorrect path or host configuration',
                'TLS certificate issues',
                'Backend service issues'
            ],
            solutions: [
                {
                    issue: 'Ingress class missing',
                    commands: [
                        'kubectl get ingressclass',
                        'kubectl get ingress <ingress-name> -o yaml'
                    ],
                    fix: 'Set ingressClassName in ingress specification'
                },
                {
                    issue: 'Path configuration issues',
                    commands: [
                        'kubectl describe ingress <ingress-name>',
                        'kubectl get ingress <ingress-name> -o yaml'
                    ],
                    fix: 'Verify host and path configuration match your requirements'
                },
                {
                    issue: 'TLS certificate problems',
                    commands: [
                        'kubectl get secret <tls-secret-name> -o yaml',
                        'kubectl describe ingress <ingress-name>'
                    ],
                    fix: 'Ensure TLS secret exists and contains valid certificate and key'
                }
            ]
        });

        this.troubleshootingGuides.set('performance-issues', {
            title: 'Performance Issues',
            symptoms: ['Slow response times', 'High CPU/memory usage', 'Pod restarts'],
            causes: [
                'Insufficient resource allocation',
                'Memory leaks',
                'Database connection issues',
                'Inefficient application code'
            ],
            solutions: [
                {
                    issue: 'Resource constraints',
                    commands: [
                        'kubectl top pods',
                        'kubectl describe pod <pod-name>',
                        'kubectl get hpa'
                    ],
                    fix: 'Increase resource limits and requests, enable autoscaling'
                },
                {
                    issue: 'Memory leaks',
                    commands: [
                        'kubectl top pods --sort-by=memory',
                        'kubectl logs <pod-name>'
                    ],
                    fix: 'Analyze application logs for memory usage patterns and fix leaks'
                },
                {
                    issue: 'Database performance',
                    commands: [
                        'kubectl logs <app-pod-name> | grep -i database',
                        'kubectl get pods -l component=database'
                    ],
                    fix: 'Optimize database queries, increase database resources, use connection pooling'
                }
            ]
        });
    }

    /**
     * Initialize API documentation templates
     */
    initializeApiDocumentation() {
        this.apiDocumentation.set('helm-chart-api', {
            title: 'Helm Chart API Documentation',
            description: 'API interface for Helm chart configuration and deployment',
            endpoints: [
                {
                    path: '/values',
                    method: 'GET',
                    description: 'Retrieve chart values schema',
                    response: {
                        type: 'object',
                        properties: {
                            schema: { type: 'object', description: 'Values schema' },
                            examples: { type: 'array', description: 'Example configurations' }
                        }
                    }
                },
                {
                    path: '/templates',
                    method: 'GET',
                    description: 'List available templates',
                    response: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                name: { type: 'string', description: 'Template name' },
                                type: { type: 'string', description: 'Resource type' },
                                description: { type: 'string', description: 'Template description' }
                            }
                        }
                    }
                },
                {
                    path: '/render',
                    method: 'POST',
                    description: 'Render templates with provided values',
                    requestBody: {
                        type: 'object',
                        properties: {
                            values: { type: 'object', description: 'Chart values' },
                            templates: { type: 'array', description: 'Templates to render' }
                        }
                    },
                    response: {
                        type: 'object',
                        properties: {
                            manifests: { type: 'array', description: 'Rendered Kubernetes manifests' },
                            errors: { type: 'array', description: 'Rendering errors' }
                        }
                    }
                }
            ]
        });

        this.apiDocumentation.set('application-api', {
            title: 'Application API Documentation',
            description: 'REST API endpoints for the deployed application',
            baseUrl: 'https://api.example.com',
            authentication: {
                type: 'Bearer',
                description: 'API key authentication using Bearer token'
            },
            endpoints: [
                {
                    path: '/health',
                    method: 'GET',
                    description: 'Health check endpoint',
                    response: {
                        type: 'object',
                        properties: {
                            status: { type: 'string', enum: ['healthy', 'unhealthy'] },
                            timestamp: { type: 'string', format: 'date-time' },
                            version: { type: 'string', description: 'Application version' }
                        }
                    }
                },
                {
                    path: '/metrics',
                    method: 'GET',
                    description: 'Prometheus metrics endpoint',
                    response: {
                        type: 'string',
                        description: 'Prometheus format metrics'
                    }
                },
                {
                    path: '/ready',
                    method: 'GET',
                    description: 'Readiness probe endpoint',
                    response: {
                        type: 'object',
                        properties: {
                            ready: { type: 'boolean', description: 'Application readiness status' },
                            checks: { type: 'array', description: 'Individual readiness checks' }
                        }
                    }
                }
            ]
        });
    }

    /**
     * Generate comprehensive documentation for a chart
     * @param {string} chartPath - Path to chart directory
     * @param {Object} options - Documentation generation options
     * @returns {Object} Generated documentation
     */
    async generateChartDocumentation(chartPath, options = {}) {
        console.log(`📚 Generating comprehensive documentation for: ${chartPath}`);
        
        const documentation = {
            readme: null,
            valuesDoc: null,
            usageExamples: [],
            troubleshootingGuide: null,
            apiDoc: null,
            changelog: null,
            files: {}
        };

        try {
            // Load chart metadata
            const chartMetadata = await this.loadChartMetadata(chartPath);
            const valuesSchema = await this.extractValuesSchema(chartPath);
            const templates = await this.analyzeTemplates(chartPath);

            // Generate README.md
            console.log('📝 Generating README.md...');
            documentation.readme = this.generateReadme(chartMetadata, valuesSchema, templates, options);
            documentation.files['README.md'] = documentation.readme;

            // Generate values documentation
            console.log('⚙️ Generating values documentation...');
            documentation.valuesDoc = this.generateValuesDocumentation(valuesSchema, chartMetadata);
            documentation.files['VALUES.md'] = documentation.valuesDoc;

            // Generate usage examples
            console.log('💡 Generating usage examples...');
            documentation.usageExamples = this.generateUsageExamples(chartMetadata, valuesSchema);
            documentation.files['EXAMPLES.md'] = this.formatUsageExamples(documentation.usageExamples);

            // Generate troubleshooting guide
            console.log('🔧 Generating troubleshooting guide...');
            documentation.troubleshootingGuide = this.generateTroubleshootingGuide(chartMetadata, templates);
            documentation.files['TROUBLESHOOTING.md'] = documentation.troubleshootingGuide;

            // Generate API documentation
            console.log('🔌 Generating API documentation...');
            documentation.apiDoc = this.generateApiDocumentation(chartMetadata, templates);
            documentation.files['API.md'] = documentation.apiDoc;

            // Generate changelog template
            console.log('📅 Generating changelog template...');
            documentation.changelog = this.generateChangelogTemplate(chartMetadata);
            documentation.files['CHANGELOG.md'] = documentation.changelog;

            // Generate additional documentation files
            if (options.includeContributing) {
                documentation.files['CONTRIBUTING.md'] = this.generateContributingGuide(chartMetadata);
            }

            if (options.includeSecurity) {
                documentation.files['SECURITY.md'] = this.generateSecurityGuide(chartMetadata);
            }

            console.log(`✅ Documentation generation complete. Generated ${Object.keys(documentation.files).length} files.`);
            return documentation;

        } catch (error) {
            console.error('❌ Documentation generation failed:', error.message);
            throw new Error(`Documentation generation failed: ${error.message}`);
        }
    }

    /**
     * Load chart metadata from Chart.yaml
     * @param {string} chartPath - Path to chart directory
     * @returns {Object} Chart metadata
     */
    async loadChartMetadata(chartPath) {
        const chartYamlPath = path.join(chartPath, 'Chart.yaml');
        
        if (!fs.existsSync(chartYamlPath)) {
            throw new Error('Chart.yaml not found');
        }

        const chartYamlContent = fs.readFileSync(chartYamlPath, 'utf8');
        const chartMetadata = yaml.parse(chartYamlContent);

        // Add additional metadata
        chartMetadata.templates = [];
        chartMetadata.dependencies = chartMetadata.dependencies || [];
        chartMetadata.keywords = chartMetadata.keywords || [];
        chartMetadata.sources = chartMetadata.sources || [];

        return chartMetadata;
    }

    /**
     * Extract values schema from values.yaml and templates
     * @param {string} chartPath - Path to chart directory
     * @returns {Object} Values schema with descriptions
     */
    async extractValuesSchema(chartPath) {
        const valuesYamlPath = path.join(chartPath, 'values.yaml');
        const schema = {
            properties: {},
            examples: {},
            descriptions: {}
        };

        if (fs.existsSync(valuesYamlPath)) {
            const valuesContent = fs.readFileSync(valuesYamlPath, 'utf8');
            const values = yaml.parse(valuesContent);
            
            schema.properties = this.analyzeValuesStructure(values);
            schema.examples.default = values;
            schema.descriptions = this.extractValueDescriptions(valuesContent);
        }

        // Extract additional schemas from templates
        const templatesPath = path.join(chartPath, 'templates');
        if (fs.existsSync(templatesPath)) {
            const templateFiles = fs.readdirSync(templatesPath)
                .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
            
            for (const file of templateFiles) {
                const templateContent = fs.readFileSync(path.join(templatesPath, file), 'utf8');
                const referencedValues = this.extractValueReferences(templateContent);
                
                for (const valueRef of referencedValues) {
                    if (!schema.properties[valueRef]) {
                        schema.properties[valueRef] = { type: 'unknown', inferredFrom: file };
                    }
                }
            }
        }

        return schema;
    }

    /**
     * Analyze template files
     * @param {string} chartPath - Path to chart directory
     * @returns {Array} Template analysis results
     */
    async analyzeTemplates(chartPath) {
        const templates = [];
        const templatesPath = path.join(chartPath, 'templates');

        if (!fs.existsSync(templatesPath)) {
            return templates;
        }

        const templateFiles = fs.readdirSync(templatesPath)
            .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

        for (const file of templateFiles) {
            const filePath = path.join(templatesPath, file);
            const content = fs.readFileSync(filePath, 'utf8');
            
            const template = {
                filename: file,
                resourceTypes: this.extractResourceTypes(content),
                valueReferences: this.extractValueReferences(content),
                conditionals: this.extractConditionals(content),
                loops: this.extractLoops(content),
                includes: this.extractIncludes(content)
            };

            templates.push(template);
        }

        return templates;
    }

    /**
     * Generate README.md content
     * @param {Object} chartMetadata - Chart metadata
     * @param {Object} valuesSchema - Values schema
     * @param {Array} templates - Template analysis
     * @param {Object} options - Generation options
     * @returns {string} README.md content
     */
    generateReadme(chartMetadata, valuesSchema, templates, options) {
        let readme = `# ${chartMetadata.name}\n\n`;
        
        // Description
        readme += `${chartMetadata.description || 'A Helm chart for Kubernetes'}\n\n`;
        
        // Badges
        readme += `![Version](https://img.shields.io/badge/Version-${chartMetadata.version}-informational?style=flat-square)\n`;
        readme += `![Type](https://img.shields.io/badge/Type-${chartMetadata.type || 'application'}-informational?style=flat-square)\n`;
        if (chartMetadata.appVersion) {
            readme += `![AppVersion](https://img.shields.io/badge/AppVersion-${chartMetadata.appVersion}-informational?style=flat-square)\n`;
        }
        readme += `\n`;

        // Table of Contents
        readme += `## Table of Contents\n\n`;
        readme += `- [Prerequisites](#prerequisites)\n`;
        readme += `- [Installation](#installation)\n`;
        readme += `- [Configuration](#configuration)\n`;
        readme += `- [Usage Examples](#usage-examples)\n`;
        readme += `- [Troubleshooting](#troubleshooting)\n`;
        readme += `- [Contributing](#contributing)\n\n`;

        // Prerequisites
        readme += `## Prerequisites\n\n`;
        readme += `- Kubernetes ${chartMetadata.kubeVersion || '1.19+'}\n`;
        readme += `- Helm 3.0+\n\n`;

        if (chartMetadata.dependencies && chartMetadata.dependencies.length > 0) {
            readme += `### Dependencies\n\n`;
            for (const dep of chartMetadata.dependencies) {
                readme += `- **${dep.name}** (${dep.version}) - ${dep.repository}\n`;
            }
            readme += `\n`;
        }

        // Installation
        readme += `## Installation\n\n`;
        readme += `### Add Helm Repository\n\n`;
        readme += `\`\`\`bash\n`;
        readme += `helm repo add ${chartMetadata.name}-repo https://charts.example.com\n`;
        readme += `helm repo update\n`;
        readme += `\`\`\`\n\n`;

        readme += `### Install Chart\n\n`;
        readme += `\`\`\`bash\n`;
        readme += `helm install my-${chartMetadata.name} ${chartMetadata.name}-repo/${chartMetadata.name}\n`;
        readme += `\`\`\`\n\n`;

        readme += `### Install with Custom Values\n\n`;
        readme += `\`\`\`bash\n`;
        readme += `helm install my-${chartMetadata.name} ${chartMetadata.name}-repo/${chartMetadata.name} -f values.yaml\n`;
        readme += `\`\`\`\n\n`;

        // Configuration
        readme += `## Configuration\n\n`;
        readme += `The following table lists the configurable parameters and their default values.\n\n`;
        readme += `| Parameter | Description | Default |\n`;
        readme += `|-----------|-------------|---------|\n`;

        const flattenedValues = this.flattenObject(valuesSchema.properties);
        for (const [key, value] of Object.entries(flattenedValues)) {
            const description = valuesSchema.descriptions[key] || 'No description available';
            const defaultValue = value.default !== undefined ? `\`${JSON.stringify(value.default)}\`` : '`null`';
            readme += `| \`${key}\` | ${description} | ${defaultValue} |\n`;
        }
        readme += `\n`;

        readme += `For a complete list of configuration options, see [VALUES.md](VALUES.md).\n\n`;

        // Usage Examples
        readme += `## Usage Examples\n\n`;
        readme += `For detailed usage examples, see [EXAMPLES.md](EXAMPLES.md).\n\n`;

        // Quick Examples
        readme += `### Basic Example\n\n`;
        readme += `\`\`\`yaml\n`;
        readme += `# values.yaml\n`;
        readme += `replicaCount: 1\n`;
        readme += `image:\n`;
        readme += `  repository: nginx\n`;
        readme += `  tag: "1.21"\n`;
        readme += `service:\n`;
        readme += `  type: ClusterIP\n`;
        readme += `  port: 80\n`;
        readme += `\`\`\`\n\n`;

        // Generated Resources
        readme += `## Generated Resources\n\n`;
        readme += `This chart generates the following Kubernetes resources:\n\n`;
        
        const resourceTypes = new Set();
        for (const template of templates) {
            for (const resourceType of template.resourceTypes) {
                resourceTypes.add(resourceType);
            }
        }

        for (const resourceType of Array.from(resourceTypes).sort()) {
            readme += `- ${resourceType}\n`;
        }
        readme += `\n`;

        // Troubleshooting
        readme += `## Troubleshooting\n\n`;
        readme += `For troubleshooting information, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).\n\n`;

        // Contributing
        readme += `## Contributing\n\n`;
        readme += `Contributions are welcome! Please read the [contributing guidelines](CONTRIBUTING.md) first.\n\n`;

        // License
        readme += `## License\n\n`;
        readme += `This chart is licensed under the ${chartMetadata.license || 'Apache 2.0'} license.\n`;

        return readme;
    }

    /**
     * Generate values documentation
     * @param {Object} valuesSchema - Values schema
     * @param {Object} chartMetadata - Chart metadata
     * @returns {string} Values documentation
     */
    generateValuesDocumentation(valuesSchema, chartMetadata) {
        let doc = `# Values Documentation\n\n`;
        doc += `This document describes all configurable values for the ${chartMetadata.name} Helm chart.\n\n`;

        // Overview
        doc += `## Overview\n\n`;
        doc += `The chart supports the following configuration categories:\n\n`;

        const categories = this.categorizeValues(valuesSchema.properties);
        for (const [category, values] of Object.entries(categories)) {
            doc += `- **${category}**: ${Object.keys(values).length} parameters\n`;
        }
        doc += `\n`;

        // Detailed configuration by category
        for (const [category, values] of Object.entries(categories)) {
            doc += `## ${category.charAt(0).toUpperCase() + category.slice(1)} Configuration\n\n`;
            
            doc += `| Parameter | Type | Description | Default |\n`;
            doc += `|-----------|------|-------------|---------|\n`;
            
            for (const [key, value] of Object.entries(values)) {
                const type = value.type || 'unknown';
                const description = valuesSchema.descriptions[key] || 'No description available';
                const defaultValue = value.default !== undefined ? `\`${JSON.stringify(value.default)}\`` : '`null`';
                doc += `| \`${key}\` | ${type} | ${description} | ${defaultValue} |\n`;
            }
            doc += `\n`;
        }

        // Examples section
        doc += `## Configuration Examples\n\n`;
        
        for (const [scenarioName, scenario] of this.exampleScenarios.entries()) {
            doc += `### ${scenario.title}\n\n`;
            doc += `${scenario.description}\n\n`;
            doc += `\`\`\`yaml\n`;
            doc += yaml.stringify(scenario.values);
            doc += `\`\`\`\n\n`;
        }

        return doc;
    }

    /**
     * Generate usage examples
     * @param {Object} chartMetadata - Chart metadata
     * @param {Object} valuesSchema - Values schema
     * @returns {Array} Usage examples
     */
    generateUsageExamples(chartMetadata, valuesSchema) {
        const examples = [];

        for (const [scenarioName, scenario] of this.exampleScenarios.entries()) {
            const example = {
                title: scenario.title,
                description: scenario.description,
                valuesFile: `values-${scenarioName}.yaml`,
                values: scenario.values,
                commands: scenario.commands || [],
                verification: this.generateVerificationCommands(scenario),
                cleanup: this.generateCleanupCommands(scenarioName)
            };

            // Add environment-specific examples for multi-environment scenario
            if (scenario.environments) {
                example.environments = scenario.environments;
            }

            examples.push(example);
        }

        return examples;
    }

    /**
     * Format usage examples as markdown
     * @param {Array} examples - Usage examples
     * @returns {string} Formatted examples
     */
    formatUsageExamples(examples) {
        let doc = `# Usage Examples\n\n`;
        doc += `This document provides practical examples for deploying and configuring the chart.\n\n`;

        doc += `## Table of Contents\n\n`;
        for (const example of examples) {
            doc += `- [${example.title}](#${example.title.toLowerCase().replace(/\s+/g, '-')})\n`;
        }
        doc += `\n`;

        for (const example of examples) {
            doc += `## ${example.title}\n\n`;
            doc += `${example.description}\n\n`;

            // Values file
            doc += `### Values File\n\n`;
            doc += `Create a file named \`${example.valuesFile}\`:\n\n`;
            doc += `\`\`\`yaml\n`;
            doc += yaml.stringify(example.values);
            doc += `\`\`\`\n\n`;

            // Commands
            doc += `### Deployment Commands\n\n`;
            doc += `\`\`\`bash\n`;
            for (const command of example.commands) {
                doc += `${command}\n`;
            }
            doc += `\`\`\`\n\n`;

            // Verification
            doc += `### Verification\n\n`;
            doc += `Verify the deployment:\n\n`;
            doc += `\`\`\`bash\n`;
            for (const command of example.verification) {
                doc += `${command}\n`;
            }
            doc += `\`\`\`\n\n`;

            // Cleanup
            doc += `### Cleanup\n\n`;
            doc += `\`\`\`bash\n`;
            for (const command of example.cleanup) {
                doc += `${command}\n`;
            }
            doc += `\`\`\`\n\n`;

            // Environment-specific examples
            if (example.environments) {
                doc += `### Environment-Specific Deployments\n\n`;
                for (const [envName, envConfig] of Object.entries(example.environments)) {
                    doc += `#### ${envName.charAt(0).toUpperCase() + envName.slice(1)}\n\n`;
                    doc += `\`\`\`bash\n`;
                    doc += `kubectl create namespace ${envConfig.namespace}\n`;
                    doc += `helm install my-app chart-repo/my-chart -n ${envConfig.namespace} --set-file values-${envName}.yaml\n`;
                    doc += `\`\`\`\n\n`;
                }
            }
        }

        return doc;
    }

    /**
     * Generate troubleshooting guide
     * @param {Object} chartMetadata - Chart metadata
     * @param {Array} templates - Template analysis
     * @returns {string} Troubleshooting guide
     */
    generateTroubleshootingGuide(chartMetadata, templates) {
        let doc = `# Troubleshooting Guide\n\n`;
        doc += `This guide helps you diagnose and resolve common issues with the ${chartMetadata.name} chart.\n\n`;

        doc += `## Quick Diagnosis\n\n`;
        doc += `Start with these commands to gather information:\n\n`;
        doc += `\`\`\`bash\n`;
        doc += `# Check release status\n`;
        doc += `helm status <release-name>\n\n`;
        doc += `# Check pods\n`;
        doc += `kubectl get pods -l app.kubernetes.io/instance=<release-name>\n\n`;
        doc += `# Check events\n`;
        doc += `kubectl get events --sort-by=.metadata.creationTimestamp\n\n`;
        doc += `# Check logs\n`;
        doc += `kubectl logs -l app.kubernetes.io/instance=<release-name> --tail=100\n`;
        doc += `\`\`\`\n\n`;

        // Common issues
        doc += `## Common Issues\n\n`;

        for (const [issueKey, issue] of this.troubleshootingGuides.entries()) {
            doc += `### ${issue.title}\n\n`;
            
            doc += `**Symptoms:**\n`;
            for (const symptom of issue.symptoms) {
                doc += `- ${symptom}\n`;
            }
            doc += `\n`;

            doc += `**Common Causes:**\n`;
            for (const cause of issue.causes) {
                doc += `- ${cause}\n`;
            }
            doc += `\n`;

            doc += `**Solutions:**\n\n`;
            for (const solution of issue.solutions) {
                doc += `#### ${solution.issue}\n\n`;
                doc += `Diagnostic commands:\n`;
                doc += `\`\`\`bash\n`;
                for (const command of solution.commands) {
                    doc += `${command}\n`;
                }
                doc += `\`\`\`\n\n`;
                doc += `**Fix:** ${solution.fix}\n\n`;
            }
        }

        // Debug commands section
        doc += `## Debug Commands Reference\n\n`;
        doc += `### Helm Commands\n\n`;
        doc += `\`\`\`bash\n`;
        doc += `# Test template rendering\n`;
        doc += `helm template <release-name> . --debug\n\n`;
        doc += `# Dry run install\n`;
        doc += `helm install <release-name> . --dry-run --debug\n\n`;
        doc += `# Get values\n`;
        doc += `helm get values <release-name>\n\n`;
        doc += `# Get manifest\n`;
        doc += `helm get manifest <release-name>\n`;
        doc += `\`\`\`\n\n`;

        doc += `### Kubernetes Commands\n\n`;
        doc += `\`\`\`bash\n`;
        doc += `# Describe resources\n`;
        doc += `kubectl describe pod <pod-name>\n`;
        doc += `kubectl describe service <service-name>\n`;
        doc += `kubectl describe ingress <ingress-name>\n\n`;
        doc += `# Check resource usage\n`;
        doc += `kubectl top pods\n`;
        doc += `kubectl top nodes\n\n`;
        doc += `# Port forwarding for testing\n`;
        doc += `kubectl port-forward svc/<service-name> 8080:80\n`;
        doc += `\`\`\`\n\n`;

        // Getting help section
        doc += `## Getting Help\n\n`;
        doc += `If you're still experiencing issues:\n\n`;
        doc += `1. Check the chart's [GitHub Issues](https://github.com/example/chart/issues)\n`;
        doc += `2. Review the [Values Documentation](VALUES.md)\n`;
        doc += `3. Try the [Usage Examples](EXAMPLES.md)\n`;
        doc += `4. Join our community chat or forum\n\n`;

        return doc;
    }

    /**
     * Generate API documentation
     * @param {Object} chartMetadata - Chart metadata
     * @param {Array} templates - Template analysis
     * @returns {string} API documentation
     */
    generateApiDocumentation(chartMetadata, templates) {
        let doc = `# API Documentation\n\n`;
        doc += `This document describes the APIs and interfaces provided by the ${chartMetadata.name} chart.\n\n`;

        // Chart API
        const chartApi = this.apiDocumentation.get('helm-chart-api');
        doc += `## ${chartApi.title}\n\n`;
        doc += `${chartApi.description}\n\n`;

        doc += `### Endpoints\n\n`;
        for (const endpoint of chartApi.endpoints) {
            doc += `#### \`${endpoint.method} ${endpoint.path}\`\n\n`;
            doc += `${endpoint.description}\n\n`;

            if (endpoint.requestBody) {
                doc += `**Request Body:**\n`;
                doc += `\`\`\`json\n`;
                doc += JSON.stringify(endpoint.requestBody, null, 2);
                doc += `\n\`\`\`\n\n`;
            }

            doc += `**Response:**\n`;
            doc += `\`\`\`json\n`;
            doc += JSON.stringify(endpoint.response, null, 2);
            doc += `\n\`\`\`\n\n`;
        }

        // Application API
        const appApi = this.apiDocumentation.get('application-api');
        doc += `## ${appApi.title}\n\n`;
        doc += `${appApi.description}\n\n`;
        doc += `**Base URL:** ${appApi.baseUrl}\n\n`;

        if (appApi.authentication) {
            doc += `### Authentication\n\n`;
            doc += `**Type:** ${appApi.authentication.type}\n`;
            doc += `${appApi.authentication.description}\n\n`;
            doc += `**Example:**\n`;
            doc += `\`\`\`http\n`;
            doc += `Authorization: Bearer <your-api-token>\n`;
            doc += `\`\`\`\n\n`;
        }

        doc += `### Endpoints\n\n`;
        for (const endpoint of appApi.endpoints) {
            doc += `#### \`${endpoint.method} ${endpoint.path}\`\n\n`;
            doc += `${endpoint.description}\n\n`;

            doc += `**Response:**\n`;
            doc += `\`\`\`json\n`;
            doc += JSON.stringify(endpoint.response, null, 2);
            doc += `\n\`\`\`\n\n`;
        }

        return doc;
    }

    /**
     * Generate changelog template
     * @param {Object} chartMetadata - Chart metadata
     * @returns {string} Changelog template
     */
    generateChangelogTemplate(chartMetadata) {
        let changelog = `# Changelog\n\n`;
        changelog += `All notable changes to the ${chartMetadata.name} chart will be documented in this file.\n\n`;
        changelog += `The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),\n`;
        changelog += `and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).\n\n`;

        changelog += `## [Unreleased]\n\n`;
        changelog += `### Added\n`;
        changelog += `- New features go here\n\n`;
        changelog += `### Changed\n`;
        changelog += `- Changes to existing functionality go here\n\n`;
        changelog += `### Deprecated\n`;
        changelog += `- Features that will be removed in future versions go here\n\n`;
        changelog += `### Removed\n`;
        changelog += `- Features removed in this version go here\n\n`;
        changelog += `### Fixed\n`;
        changelog += `- Bug fixes go here\n\n`;
        changelog += `### Security\n`;
        changelog += `- Security improvements go here\n\n`;

        changelog += `## [${chartMetadata.version}] - ${new Date().toISOString().split('T')[0]}\n\n`;
        changelog += `### Added\n`;
        changelog += `- Initial chart release\n`;

        return changelog;
    }

    /**
     * Generate contributing guide
     * @param {Object} chartMetadata - Chart metadata
     * @returns {string} Contributing guide
     */
    generateContributingGuide(chartMetadata) {
        let doc = `# Contributing to ${chartMetadata.name}\n\n`;
        doc += `Thank you for your interest in contributing! This document provides guidelines for contributing to the chart.\n\n`;

        doc += `## Getting Started\n\n`;
        doc += `### Prerequisites\n\n`;
        doc += `- Kubernetes cluster for testing\n`;
        doc += `- Helm 3.0+\n`;
        doc += `- Git\n\n`;

        doc += `### Development Setup\n\n`;
        doc += `1. Fork the repository\n`;
        doc += `2. Clone your fork locally\n`;
        doc += `3. Create a new branch for your changes\n\n`;
        doc += `\`\`\`bash\n`;
        doc += `git clone https://github.com/yourusername/${chartMetadata.name}\n`;
        doc += `cd ${chartMetadata.name}\n`;
        doc += `git checkout -b feature/your-feature-name\n`;
        doc += `\`\`\`\n\n`;

        doc += `## Making Changes\n\n`;
        doc += `### Chart Changes\n\n`;
        doc += `1. Make your changes to the chart templates or values\n`;
        doc += `2. Test your changes locally\n`;
        doc += `3. Update documentation if needed\n`;
        doc += `4. Bump the chart version in Chart.yaml\n\n`;

        doc += `### Testing\n\n`;
        doc += `Before submitting your changes, ensure they work correctly:\n\n`;
        doc += `\`\`\`bash\n`;
        doc += `# Lint the chart\n`;
        doc += `helm lint .\n\n`;
        doc += `# Test template rendering\n`;
        doc += `helm template test-release . --debug\n\n`;
        doc += `# Install and test\n`;
        doc += `helm install test-release . --debug\n`;
        doc += `kubectl get all -l app.kubernetes.io/instance=test-release\n\n`;
        doc += `# Clean up\n`;
        doc += `helm uninstall test-release\n`;
        doc += `\`\`\`\n\n`;

        doc += `## Submitting Changes\n\n`;
        doc += `1. Commit your changes with a clear commit message\n`;
        doc += `2. Push to your fork\n`;
        doc += `3. Create a pull request\n\n`;
        doc += `### Pull Request Guidelines\n\n`;
        doc += `- Provide a clear description of the changes\n`;
        doc += `- Reference any related issues\n`;
        doc += `- Include test results\n`;
        doc += `- Update documentation if needed\n\n`;

        return doc;
    }

    /**
     * Generate security guide
     * @param {Object} chartMetadata - Chart metadata
     * @returns {string} Security guide
     */
    generateSecurityGuide(chartMetadata) {
        let doc = `# Security Guide\n\n`;
        doc += `This document outlines security considerations and best practices for the ${chartMetadata.name} chart.\n\n`;

        doc += `## Security Features\n\n`;
        doc += `### Pod Security\n\n`;
        doc += `- Runs as non-root user by default\n`;
        doc += `- Read-only root filesystem\n`;
        doc += `- Drops all capabilities except required ones\n`;
        doc += `- Security contexts enforced\n\n`;

        doc += `### Network Security\n\n`;
        doc += `- Network policies for traffic isolation\n`;
        doc += `- TLS encryption in transit\n`;
        doc += `- Service mesh integration support\n\n`;

        doc += `### Configuration Security\n\n`;
        doc += `- Secrets management with Kubernetes secrets\n`;
        doc += `- ConfigMap separation for sensitive data\n`;
        doc += `- Environment-specific configurations\n\n`;

        doc += `## Security Best Practices\n\n`;
        doc += `1. **Use specific image tags** - Avoid 'latest' tag in production\n`;
        doc += `2. **Enable resource limits** - Prevent resource exhaustion attacks\n`;
        doc += `3. **Use network policies** - Restrict network access\n`;
        doc += `4. **Regular updates** - Keep images and dependencies updated\n`;
        doc += `5. **Scan images** - Use vulnerability scanning tools\n\n`;

        doc += `## Reporting Security Issues\n\n`;
        doc += `Please report security vulnerabilities privately to security@example.com.\n`;
        doc += `Do not open public issues for security vulnerabilities.\n\n`;

        return doc;
    }

    // Helper methods for documentation generation

    /**
     * Analyze values structure recursively
     * @param {Object} values - Values object
     * @param {string} prefix - Key prefix
     * @returns {Object} Flattened structure analysis
     */
    analyzeValuesStructure(values, prefix = '') {
        const structure = {};
        
        for (const [key, value] of Object.entries(values)) {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                Object.assign(structure, this.analyzeValuesStructure(value, fullKey));
            } else {
                structure[fullKey] = {
                    type: Array.isArray(value) ? 'array' : typeof value,
                    default: value
                };
            }
        }
        
        return structure;
    }

    /**
     * Extract value descriptions from YAML comments
     * @param {string} yamlContent - YAML content with comments
     * @returns {Object} Descriptions mapped to value paths
     */
    extractValueDescriptions(yamlContent) {
        const descriptions = {};
        const lines = yamlContent.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.trim().startsWith('#')) {
                const description = line.replace(/^#\s*/, '').trim();
                // Look for the next non-comment line to find the key
                for (let j = i + 1; j < lines.length; j++) {
                    const nextLine = lines[j];
                    if (!nextLine.trim().startsWith('#') && nextLine.includes(':')) {
                        const match = nextLine.match(/^(\s*)([^:]+):/);
                        if (match) {
                            const key = match[2].trim();
                            descriptions[key] = description;
                            break;
                        }
                    }
                }
            }
        }
        
        return descriptions;
    }

    /**
     * Extract value references from template content
     * @param {string} content - Template content
     * @returns {Array} Array of value references
     */
    extractValueReferences(content) {
        const references = [];
        const regex = /\.Values\.([a-zA-Z0-9._]+)/g;
        let match;
        
        while ((match = regex.exec(content)) !== null) {
            references.push(match[1]);
        }
        
        return [...new Set(references)]; // Remove duplicates
    }

    /**
     * Extract resource types from template content
     * @param {string} content - Template content
     * @returns {Array} Array of Kubernetes resource types
     */
    extractResourceTypes(content) {
        const types = [];
        const regex = /kind:\s+([^\s]+)/g;
        let match;
        
        while ((match = regex.exec(content)) !== null) {
            types.push(match[1]);
        }
        
        return [...new Set(types)];
    }

    /**
     * Extract conditionals from template content
     * @param {string} content - Template content
     * @returns {Array} Array of conditional statements
     */
    extractConditionals(content) {
        const conditionals = [];
        const regex = /\{\{-?\s*if\s+([^}]+)\s*-?\}\}/g;
        let match;
        
        while ((match = regex.exec(content)) !== null) {
            conditionals.push(match[1].trim());
        }
        
        return conditionals;
    }

    /**
     * Extract loops from template content
     * @param {string} content - Template content
     * @returns {Array} Array of loop statements
     */
    extractLoops(content) {
        const loops = [];
        const regex = /\{\{-?\s*range\s+([^}]+)\s*-?\}\}/g;
        let match;
        
        while ((match = regex.exec(content)) !== null) {
            loops.push(match[1].trim());
        }
        
        return loops;
    }

    /**
     * Extract includes from template content
     * @param {string} content - Template content
     * @returns {Array} Array of include statements
     */
    extractIncludes(content) {
        const includes = [];
        const regex = /\{\{-?\s*include\s+"([^"]+)"/g;
        let match;
        
        while ((match = regex.exec(content)) !== null) {
            includes.push(match[1]);
        }
        
        return includes;
    }

    /**
     * Categorize values by type/purpose
     * @param {Object} values - Values structure
     * @returns {Object} Categorized values
     */
    categorizeValues(values) {
        const categories = {
            global: {},
            image: {},
            service: {},
            ingress: {},
            resources: {},
            autoscaling: {},
            security: {},
            storage: {},
            monitoring: {},
            networking: {},
            other: {}
        };

        for (const [key, value] of Object.entries(values)) {
            if (key.startsWith('global.')) {
                categories.global[key] = value;
            } else if (key.startsWith('image.')) {
                categories.image[key] = value;
            } else if (key.startsWith('service.')) {
                categories.service[key] = value;
            } else if (key.startsWith('ingress.')) {
                categories.ingress[key] = value;
            } else if (key.startsWith('resources.') || key === 'replicaCount') {
                categories.resources[key] = value;
            } else if (key.startsWith('autoscaling.')) {
                categories.autoscaling[key] = value;
            } else if (key.startsWith('security.') || key.includes('Security') || key.includes('Account')) {
                categories.security[key] = value;
            } else if (key.startsWith('persistence.') || key.includes('storage')) {
                categories.storage[key] = value;
            } else if (key.startsWith('monitoring.') || key.includes('metrics') || key.includes('probe')) {
                categories.monitoring[key] = value;
            } else if (key.startsWith('network') || key.includes('dns')) {
                categories.networking[key] = value;
            } else {
                categories.other[key] = value;
            }
        }

        // Remove empty categories
        return Object.fromEntries(
            Object.entries(categories).filter(([_, values]) => Object.keys(values).length > 0)
        );
    }

    /**
     * Flatten nested object
     * @param {Object} obj - Object to flatten
     * @param {string} prefix - Key prefix
     * @returns {Object} Flattened object
     */
    flattenObject(obj, prefix = '') {
        const flattened = {};
        
        for (const [key, value] of Object.entries(obj)) {
            const newKey = prefix ? `${prefix}.${key}` : key;
            
            if (typeof value === 'object' && value !== null && !Array.isArray(value) && !value.hasOwnProperty('type')) {
                Object.assign(flattened, this.flattenObject(value, newKey));
            } else {
                flattened[newKey] = value;
            }
        }
        
        return flattened;
    }

    /**
     * Generate verification commands for examples
     * @param {Object} scenario - Example scenario
     * @returns {Array} Verification commands
     */
    generateVerificationCommands(scenario) {
        const commands = [
            'kubectl get all -l app.kubernetes.io/instance=my-app',
            'kubectl get pods -o wide'
        ];

        if (scenario.values.ingress && scenario.values.ingress.enabled) {
            commands.push('kubectl get ingress');
        }

        if (scenario.values.autoscaling && scenario.values.autoscaling.enabled) {
            commands.push('kubectl get hpa');
        }

        if (scenario.values.persistence && scenario.values.persistence.enabled) {
            commands.push('kubectl get pvc');
        }

        return commands;
    }

    /**
     * Generate cleanup commands
     * @param {string} scenarioName - Scenario name
     * @returns {Array} Cleanup commands
     */
    generateCleanupCommands(scenarioName) {
        return [
            `helm uninstall my-app-${scenarioName}`,
            'kubectl get pods # Verify pods are terminated'
        ];
    }

    /**
     * Save generated documentation to files
     * @param {Object} documentation - Generated documentation
     * @param {string} outputPath - Output directory path
     * @returns {Object} Summary of saved files
     */
    async saveDocumentationFiles(documentation, outputPath) {
        console.log(`💾 Saving documentation files to: ${outputPath}`);
        
        const summary = {
            filesCreated: [],
            totalSize: 0,
            errors: []
        };

        // Create output directory if it doesn't exist
        if (!fs.existsSync(outputPath)) {
            fs.mkdirSync(outputPath, { recursive: true });
        }

        // Save each documentation file
        for (const [filename, content] of Object.entries(documentation.files)) {
            try {
                const filePath = path.join(outputPath, filename);
                fs.writeFileSync(filePath, content, 'utf8');
                
                const stats = fs.statSync(filePath);
                summary.filesCreated.push({
                    filename: filename,
                    size: stats.size,
                    path: filePath
                });
                summary.totalSize += stats.size;
                
                console.log(`✅ Created ${filename} (${stats.size} bytes)`);
                
            } catch (error) {
                summary.errors.push({
                    filename: filename,
                    error: error.message
                });
                console.error(`❌ Failed to create ${filename}: ${error.message}`);
            }
        }

        console.log(`📊 Documentation summary: ${summary.filesCreated.length} files, ${summary.totalSize} bytes total`);
        return summary;
    }
}

module.exports = DocumentationAutomation;

// CLI usage for documentation automation
if (require.main === module) {
    const chartPath = process.argv[2];
    const outputPath = process.argv[3] || './docs';
    
    if (!chartPath) {
        console.error('Usage: node documentation-automation.js <chart-path> [output-path]');
        console.error('Example: node documentation-automation.js ./my-chart ./docs');
        process.exit(1);
    }
    
    async function main() {
        try {
            const docAutomation = new DocumentationAutomation();
            
            console.log('🚀 Starting documentation automation...');
            const documentation = await docAutomation.generateChartDocumentation(chartPath, {
                includeContributing: true,
                includeSecurity: true
            });
            
            // Save documentation files
            const summary = await docAutomation.saveDocumentationFiles(documentation, outputPath);
            
            console.log('\n📋 Documentation Generation Summary:');
            console.log(`✅ Files Created: ${summary.filesCreated.length}`);
            console.log(`📊 Total Size: ${(summary.totalSize / 1024).toFixed(2)} KB`);
            
            if (summary.errors.length > 0) {
                console.log(`❌ Errors: ${summary.errors.length}`);
                for (const error of summary.errors) {
                    console.log(`   - ${error.filename}: ${error.error}`);
                }
            }
            
            console.log(`\n📁 Documentation available at: ${path.resolve(outputPath)}`);
            
        } catch (error) {
            console.error('❌ Documentation automation failed:', error.message);
            process.exit(1);
        }
    }
    
    main();
}