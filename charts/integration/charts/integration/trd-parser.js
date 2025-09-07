#!/usr/bin/env node

/**
 * TRD Parser for Helm Chart Specialist
 * 
 * This module parses Technical Requirements Documents (TRDs) from tech-lead-orchestrator
 * and extracts the necessary information for generating Helm charts.
 * 
 * @version 1.0.0
 * @author Helm Chart Specialist Agent
 */

const fs = require('fs');
const path = require('path');
// const yaml = require('yaml');

class TRDParser {
    constructor() {
        this.supportedApplicationTypes = [
            'web-application',
            'api-service',
            'microservice',
            'background-worker',
            'database',
            'cache',
            'queue',
            'frontend',
            'backend'
        ];
        
        this.defaultPorts = {
            'web-application': 80,
            'api-service': 8080,
            'microservice': 8080,
            'backend': 8080,
            'frontend': 3000,
            'database': 5432,
            'cache': 6379,
            'queue': 5672
        };
        
        this.defaultHealthPaths = {
            'web-application': '/health',
            'api-service': '/health',
            'microservice': '/health',
            'backend': '/health',
            'frontend': '/health',
            'database': '/health',
            'cache': '/health',
            'queue': '/health'
        };
    }

    /**
     * Parse TRD file and extract application specifications
     * @param {string} trdPath - Path to TRD file
     * @returns {Object} Parsed application specifications
     */
    async parseTRD(trdPath) {
        try {
            const trdContent = fs.readFileSync(trdPath, 'utf8');
            const trdData = this.extractTRDData(trdContent);
            
            return {
                metadata: this.extractMetadata(trdData),
                application: this.extractApplicationSpec(trdData),
                services: this.extractServices(trdData),
                dependencies: this.extractDependencies(trdData),
                resources: this.extractResourceRequirements(trdData),
                security: this.extractSecurityRequirements(trdData),
                deployment: this.extractDeploymentRequirements(trdData),
                monitoring: this.extractMonitoringRequirements(trdData),
                testing: this.extractTestingRequirements(trdData)
            };
        } catch (error) {
            throw new Error(`Failed to parse TRD: ${error.message}`);
        }
    }

    /**
     * Extract TRD data from markdown content
     * @param {string} content - TRD markdown content
     * @returns {Object} Structured TRD data
     */
    extractTRDData(content) {
        const sections = {};
        const lines = content.split('\n');
        let currentSection = '';
        let currentContent = [];
        
        for (const line of lines) {
            if (line.startsWith('#')) {
                if (currentSection) {
                    sections[currentSection] = currentContent.join('\n');
                }
                currentSection = line.replace(/^#+\s*/, '').toLowerCase().replace(/\s+/g, '_');
                currentContent = [];
            } else {
                currentContent.push(line);
            }
        }
        
        // Add last section
        if (currentSection) {
            sections[currentSection] = currentContent.join('\n');
        }
        
        return sections;
    }

    /**
     * Extract metadata from TRD
     * @param {Object} trdData - Parsed TRD data
     * @returns {Object} Metadata information
     */
    extractMetadata(trdData) {
        const metadata = {
            project_name: '',
            version: '0.1.0',
            description: '',
            environment: 'production',
            namespace: 'default',
            generated_at: new Date().toISOString()
        };
        
        // Extract from executive summary or overview
        if (trdData.executive_summary || trdData.overview) {
            const content = trdData.executive_summary || trdData.overview;
            
            // Extract project name from titles or headers
            const nameMatch = content.match(/(?:Project|Application|Service):\s*([^\n]+)/i);
            if (nameMatch) {
                metadata.project_name = nameMatch[1].trim();
            }
            
            // Extract version information
            const versionMatch = content.match(/Version:\s*([^\n]+)/i);
            if (versionMatch) {
                metadata.version = versionMatch[1].trim();
            }
            
            // Extract description
            const descMatch = content.match(/(?:Description|Summary):\s*([^\n]+)/i);
            if (descMatch) {
                metadata.description = descMatch[1].trim();
            }
        }
        
        return metadata;
    }

    /**
     * Extract application specifications
     * @param {Object} trdData - Parsed TRD data
     * @returns {Object} Application specifications
     */
    extractApplicationSpec(trdData) {
        const spec = {
            name: '',
            type: 'web-application',
            framework: '',
            language: '',
            port: 8080,
            health_endpoint: '/health',
            metrics_endpoint: '/metrics',
            startup_time: 30,
            shutdown_time: 10
        };
        
        // Extract from system architecture or technical components
        if (trdData.system_architecture || trdData.technical_components) {
            const content = trdData.system_architecture || trdData.technical_components;
            
            // Detect application type
            for (const appType of this.supportedApplicationTypes) {
                if (content.toLowerCase().includes(appType)) {
                    spec.type = appType;
                    spec.port = this.defaultPorts[appType] || 8080;
                    spec.health_endpoint = this.defaultHealthPaths[appType] || '/health';
                    break;
                }
            }
            
            // Extract framework information
            const frameworks = ['react', 'vue', 'angular', 'express', 'fastapi', 'spring', 'rails', 'django', 'nest'];
            for (const framework of frameworks) {
                if (content.toLowerCase().includes(framework)) {
                    spec.framework = framework;
                    break;
                }
            }
            
            // Extract language information
            const languages = ['javascript', 'typescript', 'python', 'java', 'go', 'rust', 'c#', 'ruby'];
            for (const lang of languages) {
                if (content.toLowerCase().includes(lang)) {
                    spec.language = lang;
                    break;
                }
            }
            
            // Extract port information
            const portMatch = content.match(/port[:\s]+(\d+)/i);
            if (portMatch) {
                spec.port = parseInt(portMatch[1]);
            }
        }
        
        return spec;
    }

    /**
     * Extract service dependencies
     * @param {Object} trdData - Parsed TRD data
     * @returns {Array} List of service dependencies
     */
    extractServices(trdData) {
        const services = [];
        
        // Look for services in architecture or dependencies sections
        const sections = [
            trdData.system_architecture,
            trdData.dependencies,
            trdData.integration_architecture,
            trdData.external_services
        ].filter(Boolean);
        
        for (const content of sections) {
            // Extract database services
            if (content.toLowerCase().includes('postgresql') || content.toLowerCase().includes('postgres')) {
                services.push({
                    name: 'postgresql',
                    type: 'database',
                    port: 5432,
                    required: true,
                    chart: 'postgresql'
                });
            }
            
            if (content.toLowerCase().includes('mysql')) {
                services.push({
                    name: 'mysql',
                    type: 'database',
                    port: 3306,
                    required: true,
                    chart: 'mysql'
                });
            }
            
            // Extract cache services
            if (content.toLowerCase().includes('redis')) {
                services.push({
                    name: 'redis',
                    type: 'cache',
                    port: 6379,
                    required: false,
                    chart: 'redis'
                });
            }
            
            // Extract message queue services
            if (content.toLowerCase().includes('rabbitmq')) {
                services.push({
                    name: 'rabbitmq',
                    type: 'queue',
                    port: 5672,
                    required: false,
                    chart: 'rabbitmq'
                });
            }
            
            if (content.toLowerCase().includes('kafka')) {
                services.push({
                    name: 'kafka',
                    type: 'streaming',
                    port: 9092,
                    required: false,
                    chart: 'kafka'
                });
            }
        }
        
        return services;
    }

    /**
     * Extract dependencies
     * @param {Object} trdData - Parsed TRD data
     * @returns {Object} Dependency information
     */
    extractDependencies(trdData) {
        return {
            helm_dependencies: this.extractHelmDependencies(trdData),
            external_apis: this.extractExternalAPIs(trdData),
            internal_services: this.extractInternalServices(trdData)
        };
    }

    /**
     * Extract Helm chart dependencies
     * @param {Object} trdData - Parsed TRD data
     * @returns {Array} Helm dependencies
     */
    extractHelmDependencies(trdData) {
        const dependencies = [];
        const services = this.extractServices(trdData);
        
        for (const service of services) {
            if (service.chart) {
                dependencies.push({
                    name: service.chart,
                    version: '^1.0.0',
                    repository: 'https://charts.bitnami.com/bitnami',
                    condition: service.required ? null : `${service.name}.enabled`
                });
            }
        }
        
        return dependencies;
    }

    /**
     * Extract external API dependencies
     * @param {Object} trdData - Parsed TRD data
     * @returns {Array} External API dependencies
     */
    extractExternalAPIs(trdData) {
        const apis = [];
        
        const sections = [
            trdData.integration_points,
            trdData.external_services,
            trdData.api_integrations
        ].filter(Boolean);
        
        for (const content of sections) {
            // Extract common external services
            const services = ['stripe', 'twilio', 'sendgrid', 'aws', 'azure', 'gcp'];
            for (const service of services) {
                if (content.toLowerCase().includes(service)) {
                    apis.push({
                        name: service,
                        type: 'external_api',
                        required: true,
                        auth_required: true
                    });
                }
            }
        }
        
        return apis;
    }

    /**
     * Extract internal service dependencies
     * @param {Object} trdData - Parsed TRD data
     * @returns {Array} Internal service dependencies
     */
    extractInternalServices(trdData) {
        const services = [];
        
        if (trdData.system_architecture) {
            const content = trdData.system_architecture;
            
            // Look for internal service references
            const serviceMatches = content.match(/([a-zA-Z-]+)-service/g) || [];
            for (const match of serviceMatches) {
                const serviceName = match.replace('-service', '');
                services.push({
                    name: serviceName,
                    type: 'internal_service',
                    required: true
                });
            }
        }
        
        return services;
    }

    /**
     * Extract resource requirements
     * @param {Object} trdData - Parsed TRD data
     * @returns {Object} Resource requirements
     */
    extractResourceRequirements(trdData) {
        const resources = {
            cpu: {
                requests: '100m',
                limits: '500m'
            },
            memory: {
                requests: '128Mi',
                limits: '512Mi'
            },
            storage: {
                enabled: false,
                size: '8Gi',
                class: ''
            },
            replicas: {
                min: 1,
                max: 10,
                default: 1
            }
        };
        
        // Extract from performance or resource sections
        const sections = [
            trdData.performance_requirements,
            trdData.resource_requirements,
            trdData.scalability_requirements
        ].filter(Boolean);
        
        for (const content of sections) {
            // Extract CPU requirements
            const cpuMatch = content.match(/cpu[:\s]+([0-9.]+[m]?)/i);
            if (cpuMatch) {
                resources.cpu.requests = cpuMatch[1];
                resources.cpu.limits = (parseInt(cpuMatch[1]) * 5) + (cpuMatch[1].includes('m') ? 'm' : '');
            }
            
            // Extract memory requirements
            const memMatch = content.match(/memory[:\s]+([0-9.]+[GM]i?)/i);
            if (memMatch) {
                resources.memory.requests = memMatch[1];
                const memValue = parseInt(memMatch[1]);
                const memUnit = memMatch[1].replace(/[0-9.]+/, '');
                resources.memory.limits = (memValue * 4) + memUnit;
            }
            
            // Extract replica requirements
            const replicaMatch = content.match(/replicas?[:\s]+(\d+)/i);
            if (replicaMatch) {
                resources.replicas.default = parseInt(replicaMatch[1]);
            }
            
            const maxReplicaMatch = content.match(/max[_\s]replicas?[:\s]+(\d+)/i);
            if (maxReplicaMatch) {
                resources.replicas.max = parseInt(maxReplicaMatch[1]);
            }
        }
        
        return resources;
    }

    /**
     * Extract security requirements
     * @param {Object} trdData - Parsed TRD data
     * @returns {Object} Security requirements
     */
    extractSecurityRequirements(trdData) {
        const security = {
            network_policies: false,
            pod_security_policy: false,
            rbac: false,
            service_account: true,
            security_context: {
                run_as_non_root: true,
                run_as_user: 65534,
                read_only_root_filesystem: true
            },
            secrets: [],
            tls: {
                enabled: false,
                cert_manager: false
            }
        };
        
        if (trdData.security_requirements || trdData.security_architecture) {
            const content = trdData.security_requirements || trdData.security_architecture;
            
            // Check for various security requirements
            if (content.toLowerCase().includes('network policy')) {
                security.network_policies = true;
            }
            
            if (content.toLowerCase().includes('rbac') || content.toLowerCase().includes('role-based')) {
                security.rbac = true;
            }
            
            if (content.toLowerCase().includes('tls') || content.toLowerCase().includes('ssl')) {
                security.tls.enabled = true;
            }
            
            if (content.toLowerCase().includes('cert-manager')) {
                security.tls.cert_manager = true;
            }
            
            // Extract secret requirements
            const secretMatches = content.match(/secret[s]?[:\s]+([^\n]+)/gi) || [];
            for (const match of secretMatches) {
                const secretName = match.replace(/secret[s]?[:\s]+/i, '').trim();
                security.secrets.push({
                    name: secretName.toLowerCase().replace(/\s+/g, '-'),
                    type: 'Opaque'
                });
            }
        }
        
        return security;
    }

    /**
     * Extract deployment requirements
     * @param {Object} trdData - Parsed TRD data
     * @returns {Object} Deployment requirements
     */
    extractDeploymentRequirements(trdData) {
        const deployment = {
            strategy: 'RollingUpdate',
            environment: 'production',
            namespace: 'default',
            ingress: {
                enabled: false,
                class: 'nginx',
                annotations: {}
            },
            service: {
                type: 'ClusterIP',
                port: 80
            },
            autoscaling: {
                enabled: false,
                min_replicas: 1,
                max_replicas: 10,
                target_cpu: 80
            }
        };
        
        if (trdData.deployment_strategy || trdData.deployment_requirements) {
            const content = trdData.deployment_strategy || trdData.deployment_requirements;
            
            // Extract deployment strategy
            if (content.toLowerCase().includes('blue-green')) {
                deployment.strategy = 'BlueGreen';
            } else if (content.toLowerCase().includes('canary')) {
                deployment.strategy = 'Canary';
            }
            
            // Extract ingress requirements
            if (content.toLowerCase().includes('ingress') || content.toLowerCase().includes('load balancer')) {
                deployment.ingress.enabled = true;
            }
            
            // Extract service type
            if (content.toLowerCase().includes('loadbalancer')) {
                deployment.service.type = 'LoadBalancer';
            } else if (content.toLowerCase().includes('nodeport')) {
                deployment.service.type = 'NodePort';
            }
            
            // Extract autoscaling requirements
            if (content.toLowerCase().includes('autoscaling') || content.toLowerCase().includes('hpa')) {
                deployment.autoscaling.enabled = true;
            }
        }
        
        return deployment;
    }

    /**
     * Extract monitoring requirements
     * @param {Object} trdData - Parsed TRD data
     * @returns {Object} Monitoring requirements
     */
    extractMonitoringRequirements(trdData) {
        const monitoring = {
            enabled: false,
            prometheus: false,
            grafana: false,
            alerts: false,
            metrics_endpoint: '/metrics',
            health_checks: {
                liveness: '/health',
                readiness: '/ready',
                startup: '/startup'
            }
        };
        
        if (trdData.monitoring || trdData.observability) {
            const content = trdData.monitoring || trdData.observability;
            
            monitoring.enabled = true;
            
            if (content.toLowerCase().includes('prometheus')) {
                monitoring.prometheus = true;
            }
            
            if (content.toLowerCase().includes('grafana')) {
                monitoring.grafana = true;
            }
            
            if (content.toLowerCase().includes('alert')) {
                monitoring.alerts = true;
            }
        }
        
        return monitoring;
    }

    /**
     * Extract testing requirements
     * @param {Object} trdData - Parsed TRD data
     * @returns {Object} Testing requirements
     */
    extractTestingRequirements(trdData) {
        const testing = {
            enabled: true,
            unit_tests: false,
            integration_tests: false,
            e2e_tests: false,
            load_tests: false,
            security_tests: false,
            test_image: 'busybox:latest'
        };
        
        if (trdData.testing_strategy || trdData.quality_gates) {
            const content = trdData.testing_strategy || trdData.quality_gates;
            
            if (content.toLowerCase().includes('unit test')) {
                testing.unit_tests = true;
            }
            
            if (content.toLowerCase().includes('integration test')) {
                testing.integration_tests = true;
            }
            
            if (content.toLowerCase().includes('e2e') || content.toLowerCase().includes('end-to-end')) {
                testing.e2e_tests = true;
            }
            
            if (content.toLowerCase().includes('load test') || content.toLowerCase().includes('performance test')) {
                testing.load_tests = true;
            }
            
            if (content.toLowerCase().includes('security test')) {
                testing.security_tests = true;
            }
        }
        
        return testing;
    }

    /**
     * Generate Helm values from parsed TRD
     * @param {Object} trdSpec - Parsed TRD specifications
     * @returns {Object} Helm chart values
     */
    generateHelmValues(trdSpec) {
        const values = {
            // Basic application configuration
            nameOverride: trdSpec.metadata.project_name || '',
            fullnameOverride: '',
            
            // Image configuration
            image: {
                repository: trdSpec.application.name || 'nginx',
                tag: trdSpec.metadata.version || 'latest',
                pullPolicy: 'IfNotPresent'
            },
            
            // Service configuration
            service: {
                type: trdSpec.deployment.service.type,
                port: trdSpec.deployment.service.port,
                targetPort: trdSpec.application.port
            },
            
            // Resource configuration
            resources: {
                limits: {
                    cpu: trdSpec.resources.cpu.limits,
                    memory: trdSpec.resources.memory.limits
                },
                requests: {
                    cpu: trdSpec.resources.cpu.requests,
                    memory: trdSpec.resources.memory.requests
                }
            },
            
            // Replica configuration
            replicaCount: trdSpec.resources.replicas.default,
            
            // Autoscaling configuration
            autoscaling: {
                enabled: trdSpec.deployment.autoscaling.enabled,
                minReplicas: trdSpec.deployment.autoscaling.min_replicas,
                maxReplicas: trdSpec.deployment.autoscaling.max_replicas,
                targetCPUUtilizationPercentage: trdSpec.deployment.autoscaling.target_cpu
            },
            
            // Ingress configuration
            ingress: {
                enabled: trdSpec.deployment.ingress.enabled,
                className: trdSpec.deployment.ingress.class,
                annotations: trdSpec.deployment.ingress.annotations,
                hosts: [],
                tls: []
            },
            
            // Security configuration
            serviceAccount: {
                create: trdSpec.security.service_account,
                annotations: {},
                name: ''
            },
            
            podSecurityContext: trdSpec.security.security_context,
            
            securityContext: {
                allowPrivilegeEscalation: false,
                runAsNonRoot: trdSpec.security.security_context.run_as_non_root,
                runAsUser: trdSpec.security.security_context.run_as_user,
                readOnlyRootFilesystem: trdSpec.security.security_context.read_only_root_filesystem,
                capabilities: {
                    drop: ['ALL']
                }
            },
            
            // Health check configuration
            livenessProbe: {
                httpGet: {
                    path: trdSpec.monitoring.health_checks.liveness,
                    port: 'http'
                },
                initialDelaySeconds: trdSpec.application.startup_time,
                periodSeconds: 10
            },
            
            readinessProbe: {
                httpGet: {
                    path: trdSpec.monitoring.health_checks.readiness,
                    port: 'http'
                },
                initialDelaySeconds: 5,
                periodSeconds: 10
            },
            
            // Monitoring configuration
            monitoring: {
                enabled: trdSpec.monitoring.enabled,
                serviceMonitor: {
                    enabled: trdSpec.monitoring.prometheus,
                    path: trdSpec.monitoring.metrics_endpoint,
                    port: 'metrics'
                }
            },
            
            // Testing configuration
            tests: {
                enabled: trdSpec.testing.enabled,
                image: {
                    repository: trdSpec.testing.test_image.split(':')[0],
                    tag: trdSpec.testing.test_image.split(':')[1] || 'latest',
                    pullPolicy: 'IfNotPresent'
                }
            },
            
            // Persistence configuration (if storage is required)
            persistence: {
                enabled: trdSpec.resources.storage.enabled,
                storageClass: trdSpec.resources.storage.class,
                size: trdSpec.resources.storage.size,
                accessMode: 'ReadWriteOnce'
            }
        };
        
        return values;
    }

    /**
     * Generate Chart.yaml from parsed TRD
     * @param {Object} trdSpec - Parsed TRD specifications
     * @returns {Object} Chart.yaml configuration
     */
    generateChartYaml(trdSpec) {
        return {
            apiVersion: 'v2',
            name: trdSpec.metadata.project_name || 'my-application',
            description: trdSpec.metadata.description || 'A Helm chart for Kubernetes',
            type: 'application',
            version: trdSpec.metadata.version || '0.1.0',
            appVersion: trdSpec.metadata.version || 'latest',
            keywords: [
                trdSpec.application.type,
                'kubernetes',
                'helm'
            ],
            home: '',
            sources: [],
            maintainers: [],
            dependencies: trdSpec.dependencies.helm_dependencies
        };
    }
}

module.exports = TRDParser;

// CLI usage
if (require.main === module) {
    const trdPath = process.argv[2];
    if (!trdPath) {
        console.error('Usage: node trd-parser.js <path-to-trd-file>');
        process.exit(1);
    }
    
    const parser = new TRDParser();
    parser.parseTRD(trdPath)
        .then(spec => {
            console.log('TRD Parsed Successfully:');
            console.log(JSON.stringify(spec, null, 2));
            
            console.log('\nGenerated Helm Values:');
            console.log(JSON.stringify(parser.generateHelmValues(spec), null, 2));
            
            console.log('\nGenerated Chart.yaml:');
            console.log(JSON.stringify(parser.generateChartYaml(spec), null, 2));
        })
        .catch(error => {
            console.error('Error parsing TRD:', error.message);
            process.exit(1);
        });
}