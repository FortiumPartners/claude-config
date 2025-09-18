#!/usr/bin/env node

/**
 * Health Framework for Helm Chart Specialist
 * 
 * This module implements comprehensive health check and probe configurations including:
 * - Liveness probe templates with smart defaults
 * - Readiness probe configurations with dependency checks
 * - Startup probe implementation with application-specific timing
 * - Health check customization based on application type
 * - Probe failure handling and recovery strategies
 * 
 * @version 1.0.0
 * @author Helm Chart Specialist Agent
 * @delegates backend-developer for probe implementation
 */

const fs = require('fs');
const path = require('path');

class HealthFramework {
    constructor() {
        this.applicationHealthPatterns = {
            'web-application': {
                healthPath: '/health',
                readinessPath: '/ready',
                startupPath: '/health',
                port: 'http',
                scheme: 'HTTP',
                startupTime: 30,
                healthCheckInterval: 10
            },
            'api-service': {
                healthPath: '/health',
                readinessPath: '/ready',
                startupPath: '/health',
                port: 'http',
                scheme: 'HTTP',
                startupTime: 20,
                healthCheckInterval: 10
            },
            'microservice': {
                healthPath: '/actuator/health',
                readinessPath: '/actuator/health/readiness',
                startupPath: '/actuator/health/liveness',
                port: 'http',
                scheme: 'HTTP',
                startupTime: 45,
                healthCheckInterval: 15
            },
            'backend': {
                healthPath: '/health',
                readinessPath: '/ready',
                startupPath: '/startup',
                port: 'http',
                scheme: 'HTTP',
                startupTime: 25,
                healthCheckInterval: 10
            },
            'frontend': {
                healthPath: '/health',
                readinessPath: '/ready',
                startupPath: '/health',
                port: 'http',
                scheme: 'HTTP',
                startupTime: 15,
                healthCheckInterval: 10
            },
            'database': {
                healthPath: null, // Use TCP check for databases
                readinessPath: null,
                startupPath: null,
                port: 5432,
                scheme: 'TCP',
                startupTime: 60,
                healthCheckInterval: 30
            },
            'cache': {
                healthPath: null, // Use TCP check for cache systems
                readinessPath: null,
                startupPath: null,
                port: 6379,
                scheme: 'TCP',
                startupTime: 10,
                healthCheckInterval: 15
            },
            'queue': {
                healthPath: '/health',
                readinessPath: '/ready',
                startupPath: '/health',
                port: 'management',
                scheme: 'HTTP',
                startupTime: 20,
                healthCheckInterval: 20
            }
        };
        
        this.frameworkHealthEndpoints = {
            'spring': {
                health: '/actuator/health',
                readiness: '/actuator/health/readiness',
                liveness: '/actuator/health/liveness'
            },
            'express': {
                health: '/health',
                readiness: '/ready',
                liveness: '/alive'
            },
            'fastapi': {
                health: '/health',
                readiness: '/ready',
                liveness: '/health'
            },
            'rails': {
                health: '/health',
                readiness: '/ready',
                liveness: '/health'
            },
            'django': {
                health: '/health/',
                readiness: '/ready/',
                liveness: '/health/'
            },
            'nest': {
                health: '/health',
                readiness: '/health/readiness',
                liveness: '/health/liveness'
            }
        };
        
        this.defaultProbeConfiguration = {
            liveness: {
                initialDelaySeconds: 30,
                periodSeconds: 10,
                timeoutSeconds: 5,
                successThreshold: 1,
                failureThreshold: 3
            },
            readiness: {
                initialDelaySeconds: 5,
                periodSeconds: 10,
                timeoutSeconds: 5,
                successThreshold: 1,
                failureThreshold: 3
            },
            startup: {
                initialDelaySeconds: 0,
                periodSeconds: 10,
                timeoutSeconds: 5,
                successThreshold: 1,
                failureThreshold: 30 // Allow more failures during startup
            }
        };
    }

    /**
     * Generate comprehensive health check configuration for application
     * @param {Object} trdSpec - Parsed TRD specifications
     * @returns {Object} Complete health check configuration
     */
    generateHealthConfiguration(trdSpec) {
        const appType = trdSpec.application?.type || 'web-application';
        const framework = trdSpec.application?.framework;
        const healthPattern = this.getHealthPattern(appType, framework);
        
        return {
            livenessProbe: this.generateLivenessProbe(trdSpec, healthPattern),
            readinessProbe: this.generateReadinessProbe(trdSpec, healthPattern),
            startupProbe: this.generateStartupProbe(trdSpec, healthPattern),
            healthEndpoints: this.generateHealthEndpoints(trdSpec, healthPattern),
            probeConfigurations: this.generateProbeConfigurations(trdSpec, healthPattern),
            failureHandling: this.generateFailureHandling(trdSpec, healthPattern)
        };
    }

    /**
     * Get health pattern based on application type and framework
     * @param {string} appType - Application type
     * @param {string} framework - Application framework
     * @returns {Object} Health pattern configuration
     */
    getHealthPattern(appType, framework) {
        let pattern = this.applicationHealthPatterns[appType] || this.applicationHealthPatterns['web-application'];
        
        // Override with framework-specific endpoints if available
        if (framework && this.frameworkHealthEndpoints[framework]) {
            const frameworkEndpoints = this.frameworkHealthEndpoints[framework];
            pattern = {
                ...pattern,
                healthPath: frameworkEndpoints.health,
                readinessPath: frameworkEndpoints.readiness,
                startupPath: frameworkEndpoints.liveness
            };
        }
        
        return pattern;
    }

    /**
     * Generate liveness probe configuration
     * @param {Object} trdSpec - Parsed TRD specifications
     * @param {Object} healthPattern - Health pattern configuration
     * @returns {Object} Liveness probe configuration
     */
    generateLivenessProbe(trdSpec, healthPattern) {
        const monitoring = trdSpec.monitoring || {};
        const application = trdSpec.application || {};
        
        const probe = {
            initialDelaySeconds: Math.max(
                application.startup_time || healthPattern.startupTime || 30,
                this.defaultProbeConfiguration.liveness.initialDelaySeconds
            ),
            periodSeconds: healthPattern.healthCheckInterval || this.defaultProbeConfiguration.liveness.periodSeconds,
            timeoutSeconds: this.defaultProbeConfiguration.liveness.timeoutSeconds,
            successThreshold: this.defaultProbeConfiguration.liveness.successThreshold,
            failureThreshold: this.defaultProbeConfiguration.liveness.failureThreshold
        };

        // Configure probe method based on application type
        if (healthPattern.scheme === 'HTTP' && healthPattern.healthPath) {
            probe.httpGet = {
                path: monitoring.health_checks?.liveness || healthPattern.healthPath,
                port: healthPattern.port,
                scheme: 'HTTP',
                httpHeaders: this.generateHealthHeaders(trdSpec)
            };
        } else if (healthPattern.scheme === 'TCP') {
            probe.tcpSocket = {
                port: application.port || healthPattern.port
            };
        } else {
            // Fallback to exec probe
            probe.exec = {
                command: this.generateHealthCommand(trdSpec, 'liveness')
            };
        }

        return probe;
    }

    /**
     * Generate readiness probe configuration
     * @param {Object} trdSpec - Parsed TRD specifications
     * @param {Object} healthPattern - Health pattern configuration
     * @returns {Object} Readiness probe configuration
     */
    generateReadinessProbe(trdSpec, healthPattern) {
        const monitoring = trdSpec.monitoring || {};
        const application = trdSpec.application || {};
        
        const probe = {
            initialDelaySeconds: this.defaultProbeConfiguration.readiness.initialDelaySeconds,
            periodSeconds: healthPattern.healthCheckInterval || this.defaultProbeConfiguration.readiness.periodSeconds,
            timeoutSeconds: this.defaultProbeConfiguration.readiness.timeoutSeconds,
            successThreshold: this.defaultProbeConfiguration.readiness.successThreshold,
            failureThreshold: this.defaultProbeConfiguration.readiness.failureThreshold
        };

        // Configure probe method based on application type
        if (healthPattern.scheme === 'HTTP' && healthPattern.readinessPath) {
            probe.httpGet = {
                path: monitoring.health_checks?.readiness || healthPattern.readinessPath,
                port: healthPattern.port,
                scheme: 'HTTP',
                httpHeaders: this.generateHealthHeaders(trdSpec)
            };
        } else if (healthPattern.scheme === 'TCP') {
            probe.tcpSocket = {
                port: application.port || healthPattern.port
            };
        } else {
            // Use exec probe for custom readiness checks
            probe.exec = {
                command: this.generateHealthCommand(trdSpec, 'readiness')
            };
        }

        return probe;
    }

    /**
     * Generate startup probe configuration
     * @param {Object} trdSpec - Parsed TRD specifications  
     * @param {Object} healthPattern - Health pattern configuration
     * @returns {Object} Startup probe configuration
     */
    generateStartupProbe(trdSpec, healthPattern) {
        const monitoring = trdSpec.monitoring || {};
        const application = trdSpec.application || {};
        
        // Calculate startup probe parameters based on startup time
        const startupTime = application.startup_time || healthPattern.startupTime || 30;
        const periodSeconds = this.defaultProbeConfiguration.startup.periodSeconds;
        const failureThreshold = Math.max(
            Math.ceil(startupTime / periodSeconds) + 3, // Add buffer
            this.defaultProbeConfiguration.startup.failureThreshold
        );
        
        const probe = {
            initialDelaySeconds: this.defaultProbeConfiguration.startup.initialDelaySeconds,
            periodSeconds: periodSeconds,
            timeoutSeconds: this.defaultProbeConfiguration.startup.timeoutSeconds,
            successThreshold: this.defaultProbeConfiguration.startup.successThreshold,
            failureThreshold: Math.min(failureThreshold, 60) // Cap at 60 to prevent excessive startup time
        };

        // Configure probe method
        if (healthPattern.scheme === 'HTTP' && healthPattern.startupPath) {
            probe.httpGet = {
                path: monitoring.health_checks?.startup || healthPattern.startupPath,
                port: healthPattern.port,
                scheme: 'HTTP',
                httpHeaders: this.generateHealthHeaders(trdSpec)
            };
        } else if (healthPattern.scheme === 'TCP') {
            probe.tcpSocket = {
                port: application.port || healthPattern.port
            };
        } else {
            // Use exec probe for custom startup checks
            probe.exec = {
                command: this.generateHealthCommand(trdSpec, 'startup')
            };
        }

        return probe;
    }

    /**
     * Generate HTTP headers for health checks
     * @param {Object} trdSpec - Parsed TRD specifications
     * @returns {Array} HTTP headers for health checks
     */
    generateHealthHeaders(trdSpec) {
        const headers = [];
        
        // Add User-Agent header
        headers.push({
            name: 'User-Agent',
            value: 'Kubernetes/1.0 (health-check)'
        });
        
        // Add Content-Type header for API services
        if (trdSpec.application?.type === 'api-service' || trdSpec.application?.type === 'microservice') {
            headers.push({
                name: 'Accept',
                value: 'application/json'
            });
        }
        
        // Add custom headers if specified in monitoring configuration
        if (trdSpec.monitoring?.health_headers) {
            for (const [name, value] of Object.entries(trdSpec.monitoring.health_headers)) {
                headers.push({ name, value });
            }
        }
        
        return headers;
    }

    /**
     * Generate health check command for exec probes
     * @param {Object} trdSpec - Parsed TRD specifications
     * @param {string} probeType - Type of probe (liveness, readiness, startup)
     * @returns {Array} Command array for exec probe
     */
    generateHealthCommand(trdSpec, probeType) {
        const appType = trdSpec.application?.type;
        const framework = trdSpec.application?.framework;
        
        // Framework-specific health commands
        if (framework === 'spring') {
            return ['sh', '-c', 'curl -f http://localhost:8080/actuator/health || exit 1'];
        } else if (framework === 'node' || framework === 'express') {
            return ['sh', '-c', 'curl -f http://localhost:8080/health || exit 1'];
        } else if (appType === 'database') {
            if (trdSpec.services?.some(s => s.name === 'postgresql')) {
                return ['pg_isready', '-h', 'localhost', '-U', '${POSTGRES_USER}'];
            } else if (trdSpec.services?.some(s => s.name === 'mysql')) {
                return ['mysqladmin', 'ping', '-h', 'localhost'];
            }
        } else if (appType === 'cache') {
            return ['redis-cli', 'ping'];
        }
        
        // Default HTTP health check command
        const port = trdSpec.application?.port || 8080;
        const path = probeType === 'readiness' ? '/ready' : '/health';
        return ['sh', '-c', `curl -f http://localhost:${port}${path} || exit 1`];
    }

    /**
     * Generate health endpoints configuration for the application
     * @param {Object} trdSpec - Parsed TRD specifications
     * @param {Object} healthPattern - Health pattern configuration
     * @returns {Object} Health endpoints configuration
     */
    generateHealthEndpoints(trdSpec, healthPattern) {
        const framework = trdSpec.application?.framework;
        const monitoring = trdSpec.monitoring || {};
        
        return {
            liveness: {
                path: monitoring.health_checks?.liveness || healthPattern.healthPath || '/health',
                port: trdSpec.application?.port || 8080,
                description: 'Liveness probe endpoint - determines if container should be restarted'
            },
            readiness: {
                path: monitoring.health_checks?.readiness || healthPattern.readinessPath || '/ready',
                port: trdSpec.application?.port || 8080,
                description: 'Readiness probe endpoint - determines if container can accept traffic'
            },
            startup: {
                path: monitoring.health_checks?.startup || healthPattern.startupPath || '/health',
                port: trdSpec.application?.port || 8080,
                description: 'Startup probe endpoint - determines if container has started successfully'
            },
            metrics: {
                path: trdSpec.monitoring?.metrics_endpoint || '/metrics',
                port: trdSpec.application?.port || 8080,
                description: 'Prometheus metrics endpoint'
            }
        };
    }

    /**
     * Generate probe configurations with environment-specific overrides
     * @param {Object} trdSpec - Parsed TRD specifications
     * @param {Object} healthPattern - Health pattern configuration
     * @returns {Object} Probe configurations
     */
    generateProbeConfigurations(trdSpec, healthPattern) {
        return {
            development: {
                liveness: {
                    ...this.generateLivenessProbe(trdSpec, healthPattern),
                    initialDelaySeconds: 10, // Faster startup in dev
                    failureThreshold: 5 // More lenient in dev
                },
                readiness: {
                    ...this.generateReadinessProbe(trdSpec, healthPattern),
                    failureThreshold: 5 // More lenient in dev
                },
                startup: {
                    ...this.generateStartupProbe(trdSpec, healthPattern),
                    failureThreshold: 10 // More lenient startup in dev
                }
            },
            staging: {
                liveness: this.generateLivenessProbe(trdSpec, healthPattern),
                readiness: this.generateReadinessProbe(trdSpec, healthPattern),
                startup: this.generateStartupProbe(trdSpec, healthPattern)
            },
            production: {
                liveness: {
                    ...this.generateLivenessProbe(trdSpec, healthPattern),
                    failureThreshold: 2 // Stricter in production
                },
                readiness: {
                    ...this.generateReadinessProbe(trdSpec, healthPattern),
                    failureThreshold: 2 // Stricter in production
                },
                startup: {
                    ...this.generateStartupProbe(trdSpec, healthPattern),
                    timeoutSeconds: 10 // Longer timeout in production
                }
            }
        };
    }

    /**
     * Generate failure handling and recovery strategies
     * @param {Object} trdSpec - Parsed TRD specifications
     * @param {Object} healthPattern - Health pattern configuration
     * @returns {Object} Failure handling configuration
     */
    generateFailureHandling(trdSpec, healthPattern) {
        return {
            livenessFailure: {
                action: 'restart',
                description: 'Container will be restarted when liveness probe fails',
                gracePeriod: trdSpec.application?.shutdown_time || 30,
                backoffPolicy: {
                    initialDelaySeconds: 10,
                    maxDelaySeconds: 300,
                    multiplier: 2
                }
            },
            readinessFailure: {
                action: 'remove_from_service',
                description: 'Container will be removed from service endpoints when readiness probe fails',
                retryPolicy: {
                    attempts: 3,
                    intervalSeconds: 10
                }
            },
            startupFailure: {
                action: 'restart',
                description: 'Container will be restarted when startup probe fails',
                maxStartupTime: Math.min(
                    (trdSpec.application?.startup_time || 30) * 2,
                    600 // Max 10 minutes
                ),
                alerting: {
                    enabled: true,
                    threshold: 2,
                    message: 'Application failing to start repeatedly'
                }
            },
            dependencies: this.generateDependencyHealthChecks(trdSpec),
            monitoring: {
                metrics: [
                    'probe_success_rate',
                    'probe_duration',
                    'probe_failure_count',
                    'container_restart_count'
                ],
                alerts: [
                    {
                        name: 'ProbeFailureRate',
                        condition: 'probe_success_rate < 0.95',
                        severity: 'warning'
                    },
                    {
                        name: 'HighProbeLatency',
                        condition: 'probe_duration > 1s',
                        severity: 'warning'
                    },
                    {
                        name: 'ContainerRestartLoop',
                        condition: 'container_restart_count > 5 in 10m',
                        severity: 'critical'
                    }
                ]
            }
        };
    }

    /**
     * Generate dependency health checks for external services
     * @param {Object} trdSpec - Parsed TRD specifications
     * @returns {Array} Dependency health checks
     */
    generateDependencyHealthChecks(trdSpec) {
        const dependencyChecks = [];
        
        if (trdSpec.services) {
            for (const service of trdSpec.services) {
                let check;
                
                switch (service.type) {
                    case 'database':
                        if (service.name === 'postgresql') {
                            check = {
                                name: service.name,
                                type: 'tcp',
                                target: `${service.name}:${service.port}`,
                                timeout: '5s',
                                required: service.required
                            };
                        } else if (service.name === 'mysql') {
                            check = {
                                name: service.name,
                                type: 'tcp',
                                target: `${service.name}:${service.port}`,
                                timeout: '5s',
                                required: service.required
                            };
                        }
                        break;
                        
                    case 'cache':
                        check = {
                            name: service.name,
                            type: 'tcp',
                            target: `${service.name}:${service.port}`,
                            timeout: '3s',
                            required: service.required
                        };
                        break;
                        
                    case 'queue':
                        check = {
                            name: service.name,
                            type: 'http',
                            target: `http://${service.name}:15672/api/healthchecks/node`, // RabbitMQ health API
                            timeout: '5s',
                            required: service.required
                        };
                        break;
                        
                    default:
                        check = {
                            name: service.name,
                            type: 'tcp',
                            target: `${service.name}:${service.port}`,
                            timeout: '5s',
                            required: service.required
                        };
                        break;
                }
                
                if (check) {
                    dependencyChecks.push(check);
                }
            }
        }
        
        // Add external API dependency checks
        if (trdSpec.dependencies?.external_apis) {
            for (const api of trdSpec.dependencies.external_apis) {
                dependencyChecks.push({
                    name: api.name,
                    type: 'http',
                    target: api.endpoint || `https://${api.name}.com/health`,
                    timeout: '10s',
                    required: api.required,
                    auth: api.auth_required
                });
            }
        }
        
        return dependencyChecks;
    }

    /**
     * Generate Helm template for health check configuration
     * @param {Object} trdSpec - Parsed TRD specifications
     * @returns {string} Helm template YAML
     */
    generateHelmHealthTemplate(trdSpec) {
        const healthConfig = this.generateHealthConfiguration(trdSpec);
        
        return `# Health Check Configuration
# Generated by Helm Chart Specialist Agent

{{- if .Values.healthChecks.enabled }}

# Liveness Probe Configuration
livenessProbe:
  {{- if .Values.healthChecks.liveness.httpGet.enabled }}
  httpGet:
    path: {{ .Values.healthChecks.liveness.httpGet.path }}
    port: {{ .Values.healthChecks.liveness.httpGet.port }}
    scheme: {{ .Values.healthChecks.liveness.httpGet.scheme }}
    {{- with .Values.healthChecks.liveness.httpGet.httpHeaders }}
    httpHeaders:
    {{- range . }}
    - name: {{ .name }}
      value: {{ .value }}
    {{- end }}
    {{- end }}
  {{- else if .Values.healthChecks.liveness.tcpSocket.enabled }}
  tcpSocket:
    port: {{ .Values.healthChecks.liveness.tcpSocket.port }}
  {{- else }}
  exec:
    command: {{ .Values.healthChecks.liveness.exec.command | toJson }}
  {{- end }}
  initialDelaySeconds: {{ .Values.healthChecks.liveness.initialDelaySeconds }}
  periodSeconds: {{ .Values.healthChecks.liveness.periodSeconds }}
  timeoutSeconds: {{ .Values.healthChecks.liveness.timeoutSeconds }}
  successThreshold: {{ .Values.healthChecks.liveness.successThreshold }}
  failureThreshold: {{ .Values.healthChecks.liveness.failureThreshold }}

# Readiness Probe Configuration
readinessProbe:
  {{- if .Values.healthChecks.readiness.httpGet.enabled }}
  httpGet:
    path: {{ .Values.healthChecks.readiness.httpGet.path }}
    port: {{ .Values.healthChecks.readiness.httpGet.port }}
    scheme: {{ .Values.healthChecks.readiness.httpGet.scheme }}
    {{- with .Values.healthChecks.readiness.httpGet.httpHeaders }}
    httpHeaders:
    {{- range . }}
    - name: {{ .name }}
      value: {{ .value }}
    {{- end }}
    {{- end }}
  {{- else if .Values.healthChecks.readiness.tcpSocket.enabled }}
  tcpSocket:
    port: {{ .Values.healthChecks.readiness.tcpSocket.port }}
  {{- else }}
  exec:
    command: {{ .Values.healthChecks.readiness.exec.command | toJson }}
  {{- end }}
  initialDelaySeconds: {{ .Values.healthChecks.readiness.initialDelaySeconds }}
  periodSeconds: {{ .Values.healthChecks.readiness.periodSeconds }}
  timeoutSeconds: {{ .Values.healthChecks.readiness.timeoutSeconds }}
  successThreshold: {{ .Values.healthChecks.readiness.successThreshold }}
  failureThreshold: {{ .Values.healthChecks.readiness.failureThreshold }}

# Startup Probe Configuration  
startupProbe:
  {{- if .Values.healthChecks.startup.httpGet.enabled }}
  httpGet:
    path: {{ .Values.healthChecks.startup.httpGet.path }}
    port: {{ .Values.healthChecks.startup.httpGet.port }}
    scheme: {{ .Values.healthChecks.startup.httpGet.scheme }}
    {{- with .Values.healthChecks.startup.httpGet.httpHeaders }}
    httpHeaders:
    {{- range . }}
    - name: {{ .name }}
      value: {{ .value }}
    {{- end }}
    {{- end }}
  {{- else if .Values.healthChecks.startup.tcpSocket.enabled }}
  tcpSocket:
    port: {{ .Values.healthChecks.startup.tcpSocket.port }}
  {{- else }}
  exec:
    command: {{ .Values.healthChecks.startup.exec.command | toJson }}
  {{- end }}
  initialDelaySeconds: {{ .Values.healthChecks.startup.initialDelaySeconds }}
  periodSeconds: {{ .Values.healthChecks.startup.periodSeconds }}
  timeoutSeconds: {{ .Values.healthChecks.startup.timeoutSeconds }}
  successThreshold: {{ .Values.healthChecks.startup.successThreshold }}
  failureThreshold: {{ .Values.healthChecks.startup.failureThreshold }}

{{- end }}`;
    }

    /**
     * Validate health check configuration
     * @param {Object} healthConfig - Health check configuration to validate
     * @returns {Object} Validation results
     */
    validateHealthConfiguration(healthConfig) {
        const issues = [];
        const warnings = [];
        const recommendations = [];

        // Validate liveness probe
        if (!healthConfig.livenessProbe) {
            issues.push('Liveness probe is required for production deployments');
        } else {
            if (healthConfig.livenessProbe.initialDelaySeconds < 10) {
                warnings.push('Liveness probe initial delay may be too short for proper startup');
            }
            if (healthConfig.livenessProbe.failureThreshold > 5) {
                warnings.push('High liveness probe failure threshold may delay restarts');
            }
        }

        // Validate readiness probe
        if (!healthConfig.readinessProbe) {
            warnings.push('Readiness probe is recommended for proper traffic management');
        } else {
            if (healthConfig.readinessProbe.periodSeconds > 30) {
                warnings.push('Readiness probe period may be too long for responsive traffic management');
            }
        }

        // Validate startup probe
        if (healthConfig.startupProbe) {
            const maxStartupTime = healthConfig.startupProbe.failureThreshold * healthConfig.startupProbe.periodSeconds;
            if (maxStartupTime > 600) {
                warnings.push('Startup probe allows very long startup time (>10 minutes)');
            }
        }

        // Validate probe endpoints
        if (healthConfig.livenessProbe?.httpGet?.path === healthConfig.readinessProbe?.httpGet?.path) {
            recommendations.push('Consider using different endpoints for liveness and readiness probes');
        }

        return {
            valid: issues.length === 0,
            issues,
            warnings,
            recommendations
        };
    }
}

module.exports = HealthFramework;

// CLI usage for health check generation
if (require.main === module) {
    const TRDParser = require('./trd-parser');
    const trdPath = process.argv[2];
    
    if (!trdPath) {
        console.error('Usage: node health-framework.js <path-to-trd-file>');
        process.exit(1);
    }
    
    async function main() {
        try {
            const parser = new TRDParser();
            const health = new HealthFramework();
            
            const trdSpec = await parser.parseTRD(trdPath);
            const healthConfig = health.generateHealthConfiguration(trdSpec);
            
            console.log('=== Health Check Configuration ===');
            console.log(JSON.stringify(healthConfig, null, 2));
            
            console.log('\n=== Helm Template ===');
            console.log(health.generateHelmHealthTemplate(trdSpec));
            
            // Validate health configuration
            const validation = health.validateHealthConfiguration(healthConfig);
            console.log('\n=== Health Configuration Validation ===');
            console.log(JSON.stringify(validation, null, 2));
            
        } catch (error) {
            console.error('Error generating health configuration:', error.message);
            process.exit(1);
        }
    }
    
    main();
}