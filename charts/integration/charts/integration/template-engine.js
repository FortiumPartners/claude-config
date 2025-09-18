#!/usr/bin/env node

/**
 * Template Engine for Helm Chart Specialist
 * 
 * This module implements comprehensive template parameterization including:
 * - Value extraction from TRD specifications  
 * - Intelligent default value determination
 * - Environment-specific override configurations
 * - Template variable naming conventions
 * - Documentation generation for values
 * 
 * @version 1.0.0
 * @author Helm Chart Specialist Agent
 * @delegates documentation-specialist for values documentation
 */

const fs = require('fs');
const path = require('path');

class TemplateEngine {
    constructor() {
        this.valueCategories = {
            global: 'Global configuration values',
            image: 'Container image configuration',
            nameOverride: 'Name override configuration', 
            service: 'Service configuration',
            ingress: 'Ingress configuration',
            resources: 'Resource limits and requests',
            autoscaling: 'Horizontal Pod Autoscaler configuration',
            nodeSelector: 'Node selection constraints',
            tolerations: 'Pod tolerations',
            affinity: 'Pod affinity rules',
            serviceAccount: 'Service account configuration',
            podAnnotations: 'Pod annotations',
            podSecurityContext: 'Pod security context',
            securityContext: 'Container security context',
            volumes: 'Volume configuration',
            volumeMounts: 'Volume mount configuration',
            env: 'Environment variables',
            envFrom: 'Environment variables from ConfigMaps/Secrets',
            livenessProbe: 'Liveness probe configuration',
            readinessProbe: 'Readiness probe configuration',
            startupProbe: 'Startup probe configuration',
            persistence: 'Persistent volume configuration',
            monitoring: 'Monitoring and observability configuration',
            networkPolicy: 'Network policy configuration',
            podDisruptionBudget: 'Pod disruption budget configuration'
        };
        
        this.environmentDefaults = {
            development: {
                replicaCount: 1,
                resources: {
                    limits: { cpu: '500m', memory: '512Mi' },
                    requests: { cpu: '100m', memory: '128Mi' }
                },
                autoscaling: { enabled: false },
                monitoring: { enabled: true },
                debug: { enabled: true },
                logLevel: 'debug'
            },
            staging: {
                replicaCount: 2,
                resources: {
                    limits: { cpu: '1000m', memory: '1Gi' },
                    requests: { cpu: '200m', memory: '256Mi' }
                },
                autoscaling: { enabled: true, minReplicas: 2, maxReplicas: 5 },
                monitoring: { enabled: true },
                debug: { enabled: false },
                logLevel: 'info'
            },
            production: {
                replicaCount: 3,
                resources: {
                    limits: { cpu: '2000m', memory: '2Gi' },
                    requests: { cpu: '500m', memory: '512Mi' }
                },
                autoscaling: { enabled: true, minReplicas: 3, maxReplicas: 10 },
                monitoring: { enabled: true },
                debug: { enabled: false },
                logLevel: 'warn'
            }
        };
        
        this.namingConventions = {
            camelCase: /^[a-z][a-zA-Z0-9]*$/,
            kebabCase: /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/,
            snakeCase: /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/,
            dotNotation: /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)*$/
        };
    }

    /**
     * Generate comprehensive values.yaml from TRD specification
     * @param {Object} trdSpec - Parsed TRD specifications
     * @returns {Object} Complete values.yaml configuration
     */
    generateValuesYaml(trdSpec) {
        const values = {
            # Default values for the Helm chart.
            # This is a YAML-formatted file.
            # Declare variables to be passed into your templates.
            
            // Global configuration
            global: this.generateGlobalValues(trdSpec),
            
            // Application metadata
            nameOverride: '',
            fullnameOverride: '',
            
            // Image configuration
            image: this.generateImageValues(trdSpec),
            
            // Service configuration
            service: this.generateServiceValues(trdSpec),
            
            // Ingress configuration  
            ingress: this.generateIngressValues(trdSpec),
            
            // Resource configuration
            resources: this.generateResourceValues(trdSpec),
            
            // Autoscaling configuration
            autoscaling: this.generateAutoscalingValues(trdSpec),
            
            // Pod configuration
            replicaCount: this.determineDefaultReplicas(trdSpec),
            podAnnotations: this.generatePodAnnotations(trdSpec),
            podLabels: this.generatePodLabels(trdSpec),
            
            // Security configuration
            serviceAccount: this.generateServiceAccountValues(trdSpec),
            podSecurityContext: this.generatePodSecurityValues(trdSpec),
            securityContext: this.generateContainerSecurityValues(trdSpec),
            
            // Health check configuration
            healthChecks: this.generateHealthCheckValues(trdSpec),
            
            // Environment configuration
            env: this.generateEnvironmentValues(trdSpec),
            envFrom: this.generateEnvironmentFromValues(trdSpec),
            
            // Volume configuration
            volumes: this.generateVolumeValues(trdSpec),
            volumeMounts: this.generateVolumeMountValues(trdSpec),
            persistence: this.generatePersistenceValues(trdSpec),
            
            // Node scheduling
            nodeSelector: {},
            tolerations: [],
            affinity: {},
            
            // Network configuration
            networkPolicy: this.generateNetworkPolicyValues(trdSpec),
            
            // Monitoring configuration
            monitoring: this.generateMonitoringValues(trdSpec),
            
            // Testing configuration
            tests: this.generateTestValues(trdSpec),
            
            // Pod disruption budget
            podDisruptionBudget: this.generatePDBValues(trdSpec)
        };

        return this.cleanupValues(values);
    }

    /**
     * Generate global configuration values
     * @param {Object} trdSpec - Parsed TRD specifications
     * @returns {Object} Global values configuration
     */
    generateGlobalValues(trdSpec) {
        return {
            // Global image registry settings
            imageRegistry: '',
            imagePullSecrets: [],
            
            // Global storage class
            storageClass: '',
            
            // Global environment
            environment: trdSpec.deployment?.environment || 'production',
            
            // Global security settings
            security: {
                runAsNonRoot: true,
                runAsUser: 65534,
                fsGroup: 65534
            },
            
            // Global labels applied to all resources
            labels: {
                'app.kubernetes.io/managed-by': 'Helm',
                'helm.sh/chart-version': '{{ .Chart.Version }}'
            },
            
            // Global annotations
            annotations: {}
        };
    }

    /**
     * Generate image configuration values
     * @param {Object} trdSpec - Parsed TRD specifications
     * @returns {Object} Image values configuration
     */
    generateImageValues(trdSpec) {
        const appName = trdSpec.application?.name || trdSpec.metadata?.project_name || 'app';
        
        return {
            repository: `{{ .Values.global.imageRegistry | default "" }}${appName}`,
            tag: '{{ .Chart.AppVersion }}',
            pullPolicy: 'IfNotPresent',
            pullSecrets: []
        };
    }

    /**
     * Generate service configuration values
     * @param {Object} trdSpec - Parsed TRD specifications
     * @returns {Object} Service values configuration
     */
    generateServiceValues(trdSpec) {
        return {
            type: trdSpec.deployment?.service?.type || 'ClusterIP',
            port: trdSpec.deployment?.service?.port || 80,
            targetPort: trdSpec.application?.port || 8080,
            protocol: 'TCP',
            annotations: {},
            labels: {},
            
            // Additional ports for multi-port services
            additionalPorts: this.generateAdditionalPorts(trdSpec)
        };
    }

    /**
     * Generate additional service ports based on application type
     * @param {Object} trdSpec - Parsed TRD specifications
     * @returns {Array} Additional ports configuration
     */
    generateAdditionalPorts(trdSpec) {
        const additionalPorts = [];
        
        // Add metrics port if monitoring is enabled
        if (trdSpec.monitoring?.enabled) {
            additionalPorts.push({
                name: 'metrics',
                port: 9090,
                targetPort: 9090,
                protocol: 'TCP'
            });
        }
        
        // Add health check port if different from main port
        const mainPort = trdSpec.application?.port || 8080;
        if (trdSpec.monitoring?.health_port && trdSpec.monitoring.health_port !== mainPort) {
            additionalPorts.push({
                name: 'health',
                port: trdSpec.monitoring.health_port,
                targetPort: trdSpec.monitoring.health_port,
                protocol: 'TCP'
            });
        }
        
        return additionalPorts;
    }

    /**
     * Generate ingress configuration values
     * @param {Object} trdSpec - Parsed TRD specifications
     * @returns {Object} Ingress values configuration
     */
    generateIngressValues(trdSpec) {
        const ingress = trdSpec.deployment?.ingress || {};
        
        return {
            enabled: ingress.enabled || false,
            className: ingress.class || 'nginx',
            annotations: {
                'nginx.ingress.kubernetes.io/rewrite-target': '/',
                ...ingress.annotations
            },
            hosts: [{
                host: `{{ .Values.global.environment }}.${trdSpec.metadata?.project_name || 'chart'}.example.com`,
                paths: [{
                    path: '/',
                    pathType: 'Prefix'
                }]
            }],
            tls: trdSpec.security?.tls?.enabled ? [{
                secretName: `${trdSpec.metadata?.project_name || 'chart'}-tls`,
                hosts: [`{{ .Values.global.environment }}.${trdSpec.metadata?.project_name || 'chart'}.example.com`]
            }] : []
        };
    }

    /**
     * Generate resource configuration values
     * @param {Object} trdSpec - Parsed TRD specifications
     * @returns {Object} Resource values configuration
     */
    generateResourceValues(trdSpec) {
        const resources = trdSpec.resources || {};
        
        return {
            limits: {
                cpu: resources.cpu?.limits || '500m',
                memory: resources.memory?.limits || '512Mi',
                'ephemeral-storage': '2Gi'
            },
            requests: {
                cpu: resources.cpu?.requests || '100m', 
                memory: resources.memory?.requests || '128Mi',
                'ephemeral-storage': '1Gi'
            }
        };
    }

    /**
     * Generate autoscaling configuration values
     * @param {Object} trdSpec - Parsed TRD specifications  
     * @returns {Object} Autoscaling values configuration
     */
    generateAutoscalingValues(trdSpec) {
        const autoscaling = trdSpec.deployment?.autoscaling || {};
        
        return {
            enabled: autoscaling.enabled || false,
            minReplicas: autoscaling.min_replicas || 1,
            maxReplicas: autoscaling.max_replicas || 10,
            targetCPUUtilizationPercentage: autoscaling.target_cpu || 80,
            targetMemoryUtilizationPercentage: autoscaling.target_memory || 80,
            
            // Advanced scaling metrics
            metrics: [],
            behavior: {
                scaleDown: {
                    stabilizationWindowSeconds: 300,
                    policies: [{
                        type: 'Percent',
                        value: 50,
                        periodSeconds: 60
                    }]
                },
                scaleUp: {
                    stabilizationWindowSeconds: 60,
                    policies: [{
                        type: 'Percent', 
                        value: 100,
                        periodSeconds: 60
                    }]
                }
            }
        };
    }

    /**
     * Generate pod annotations based on application requirements
     * @param {Object} trdSpec - Parsed TRD specifications
     * @returns {Object} Pod annotations
     */
    generatePodAnnotations(trdSpec) {
        const annotations = {
            'kubectl.kubernetes.io/default-container': trdSpec.application?.name || 'app'
        };
        
        // Add Prometheus scraping annotations if monitoring is enabled
        if (trdSpec.monitoring?.prometheus) {
            annotations['prometheus.io/scrape'] = 'true';
            annotations['prometheus.io/port'] = '9090';
            annotations['prometheus.io/path'] = trdSpec.monitoring?.metrics_endpoint || '/metrics';
        }
        
        // Add security annotations
        if (trdSpec.security?.security_context) {
            annotations['container.apparmor.security.beta.kubernetes.io/app'] = 'runtime/default';
        }
        
        return annotations;
    }

    /**
     * Generate pod labels for selection and organization  
     * @param {Object} trdSpec - Parsed TRD specifications
     * @returns {Object} Pod labels
     */
    generatePodLabels(trdSpec) {
        return {
            'app.kubernetes.io/component': trdSpec.application?.type || 'application',
            'app.kubernetes.io/part-of': trdSpec.metadata?.project_name || 'application',
            version: '{{ .Chart.AppVersion }}'
        };
    }

    /**
     * Generate service account configuration values
     * @param {Object} trdSpec - Parsed TRD specifications
     * @returns {Object} Service account values configuration
     */
    generateServiceAccountValues(trdSpec) {
        return {
            create: trdSpec.security?.service_account || true,
            automount: false, // Security best practice
            annotations: {},
            name: '', // Use default generated name
            labels: {}
        };
    }

    /**
     * Generate pod security context values
     * @param {Object} trdSpec - Parsed TRD specifications
     * @returns {Object} Pod security context values
     */
    generatePodSecurityValues(trdSpec) {
        const security = trdSpec.security?.security_context || {};
        
        return {
            runAsNonRoot: security.run_as_non_root !== false,
            runAsUser: security.run_as_user || 65534,
            runAsGroup: security.run_as_group || 65534,
            fsGroup: security.fs_group || 65534,
            fsGroupChangePolicy: 'OnRootMismatch',
            seccompProfile: {
                type: 'RuntimeDefault'
            }
        };
    }

    /**
     * Generate container security context values
     * @param {Object} trdSpec - Parsed TRD specifications
     * @returns {Object} Container security context values
     */
    generateContainerSecurityValues(trdSpec) {
        const security = trdSpec.security?.security_context || {};
        
        return {
            allowPrivilegeEscalation: false,
            readOnlyRootFilesystem: security.read_only_root_filesystem !== false,
            runAsNonRoot: true,
            runAsUser: security.run_as_user || 65534,
            runAsGroup: security.run_as_group || 65534,
            capabilities: {
                drop: ['ALL'],
                add: []
            },
            seccompProfile: {
                type: 'RuntimeDefault'
            }
        };
    }

    /**
     * Generate health check configuration values
     * @param {Object} trdSpec - Parsed TRD specifications
     * @returns {Object} Health check values configuration
     */
    generateHealthCheckValues(trdSpec) {
        const monitoring = trdSpec.monitoring || {};
        const healthChecks = monitoring.health_checks || {};
        
        return {
            enabled: true,
            liveness: {
                enabled: true,
                httpGet: {
                    enabled: true,
                    path: healthChecks.liveness || '/health',
                    port: 'http',
                    scheme: 'HTTP',
                    httpHeaders: []
                },
                tcpSocket: {
                    enabled: false,
                    port: 'http'
                },
                exec: {
                    enabled: false,
                    command: []
                },
                initialDelaySeconds: trdSpec.application?.startup_time || 30,
                periodSeconds: 10,
                timeoutSeconds: 5,
                successThreshold: 1,
                failureThreshold: 3
            },
            readiness: {
                enabled: true,
                httpGet: {
                    enabled: true,
                    path: healthChecks.readiness || '/ready',
                    port: 'http',
                    scheme: 'HTTP',
                    httpHeaders: []
                },
                tcpSocket: {
                    enabled: false,
                    port: 'http'
                },
                exec: {
                    enabled: false,
                    command: []
                },
                initialDelaySeconds: 5,
                periodSeconds: 10,
                timeoutSeconds: 5,
                successThreshold: 1,
                failureThreshold: 3
            },
            startup: {
                enabled: true,
                httpGet: {
                    enabled: true,
                    path: healthChecks.startup || '/health',
                    port: 'http',
                    scheme: 'HTTP',
                    httpHeaders: []
                },
                tcpSocket: {
                    enabled: false,
                    port: 'http'
                },
                exec: {
                    enabled: false,
                    command: []
                },
                initialDelaySeconds: 0,
                periodSeconds: 10,
                timeoutSeconds: 5,
                successThreshold: 1,
                failureThreshold: 30
            }
        };
    }

    /**
     * Generate environment variables configuration
     * @param {Object} trdSpec - Parsed TRD specifications
     * @returns {Array} Environment variables configuration
     */
    generateEnvironmentValues(trdSpec) {
        const envVars = [];
        
        // Add standard environment variables
        envVars.push({
            name: 'NODE_ENV',
            value: '{{ .Values.global.environment }}'
        });
        
        envVars.push({
            name: 'PORT',
            value: (trdSpec.application?.port || 8080).toString()
        });
        
        if (trdSpec.monitoring?.enabled) {
            envVars.push({
                name: 'METRICS_ENABLED',
                value: 'true'
            });
        }
        
        return envVars;
    }

    /**
     * Generate environment variables from ConfigMaps/Secrets
     * @param {Object} trdSpec - Parsed TRD specifications
     * @returns {Array} Environment from values configuration
     */
    generateEnvironmentFromValues(trdSpec) {
        const envFrom = [];
        
        // Add ConfigMap reference
        envFrom.push({
            configMapRef: {
                name: '{{ include "chart.fullname" . }}-config'
            }
        });
        
        // Add Secret references if secrets are defined
        if (trdSpec.security?.secrets) {
            for (const secret of trdSpec.security.secrets) {
                envFrom.push({
                    secretRef: {
                        name: secret.name
                    }
                });
            }
        }
        
        return envFrom;
    }

    /**
     * Generate volume configuration values
     * @param {Object} trdSpec - Parsed TRD specifications
     * @returns {Array} Volume values configuration
     */
    generateVolumeValues(trdSpec) {
        const volumes = [];
        
        // Add temporary directory volumes
        volumes.push({
            name: 'tmp',
            type: 'emptyDir',
            emptyDir: {
                sizeLimit: '1Gi'
            }
        });
        
        // Add persistent volume if storage is required
        if (trdSpec.resources?.storage?.enabled) {
            volumes.push({
                name: 'data',
                type: 'persistentVolumeClaim',
                persistentVolumeClaim: {
                    claimName: '{{ include "chart.fullname" . }}-data'
                }
            });
        }
        
        return volumes;
    }

    /**
     * Generate volume mount configuration values
     * @param {Object} trdSpec - Parsed TRD specifications
     * @returns {Array} Volume mount values configuration
     */
    generateVolumeMountValues(trdSpec) {
        const volumeMounts = [];
        
        // Mount tmp directory
        volumeMounts.push({
            name: 'tmp',
            mountPath: '/tmp',
            readOnly: false
        });
        
        // Mount data directory if persistent storage is enabled
        if (trdSpec.resources?.storage?.enabled) {
            volumeMounts.push({
                name: 'data',
                mountPath: '/data',
                readOnly: false
            });
        }
        
        return volumeMounts;
    }

    /**
     * Generate persistence configuration values
     * @param {Object} trdSpec - Parsed TRD specifications
     * @returns {Object} Persistence values configuration
     */
    generatePersistenceValues(trdSpec) {
        const storage = trdSpec.resources?.storage || {};
        
        return {
            enabled: storage.enabled || false,
            storageClass: storage.class || '',
            accessMode: 'ReadWriteOnce',
            size: storage.size || '8Gi',
            annotations: {},
            labels: {},
            retain: false
        };
    }

    /**
     * Generate network policy configuration values
     * @param {Object} trdSpec - Parsed TRD specifications
     * @returns {Object} Network policy values configuration
     */
    generateNetworkPolicyValues(trdSpec) {
        return {
            enabled: trdSpec.security?.network_policies || false,
            policyTypes: ['Ingress', 'Egress'],
            ingress: {
                enabled: true,
                rules: [{
                    from: [{
                        namespaceSelector: {
                            matchLabels: {
                                name: trdSpec.deployment?.namespace || 'default'
                            }
                        }
                    }],
                    ports: [{
                        protocol: 'TCP',
                        port: trdSpec.application?.port || 8080
                    }]
                }]
            },
            egress: {
                enabled: true,
                rules: [
                    // DNS
                    {
                        to: [],
                        ports: [{
                            protocol: 'UDP',
                            port: 53
                        }]
                    },
                    // HTTPS
                    {
                        to: [],
                        ports: [{
                            protocol: 'TCP', 
                            port: 443
                        }]
                    }
                ]
            }
        };
    }

    /**
     * Generate monitoring configuration values
     * @param {Object} trdSpec - Parsed TRD specifications
     * @returns {Object} Monitoring values configuration
     */
    generateMonitoringValues(trdSpec) {
        const monitoring = trdSpec.monitoring || {};
        
        return {
            enabled: monitoring.enabled || false,
            serviceMonitor: {
                enabled: monitoring.prometheus || false,
                interval: '30s',
                scrapeTimeout: '10s',
                path: monitoring.metrics_endpoint || '/metrics',
                port: 'metrics',
                labels: {},
                annotations: {}
            },
            prometheusRule: {
                enabled: monitoring.alerts || false,
                rules: []
            }
        };
    }

    /**
     * Generate test configuration values
     * @param {Object} trdSpec - Parsed TRD specifications
     * @returns {Object} Test values configuration
     */
    generateTestValues(trdSpec) {
        const testing = trdSpec.testing || {};
        
        return {
            enabled: testing.enabled || true,
            image: {
                repository: 'busybox',
                tag: 'latest',
                pullPolicy: 'IfNotPresent'
            },
            resources: {
                limits: {
                    cpu: '100m',
                    memory: '128Mi'
                },
                requests: {
                    cpu: '50m',
                    memory: '64Mi'
                }
            }
        };
    }

    /**
     * Generate pod disruption budget configuration values
     * @param {Object} trdSpec - Parsed TRD specifications
     * @returns {Object} Pod disruption budget values configuration
     */
    generatePDBValues(trdSpec) {
        const replicas = trdSpec.resources?.replicas?.default || 1;
        
        return {
            enabled: replicas > 1,
            minAvailable: replicas > 1 ? 1 : 0,
            maxUnavailable: replicas > 2 ? '50%' : 0
        };
    }

    /**
     * Determine default replica count based on environment and application type
     * @param {Object} trdSpec - Parsed TRD specifications
     * @returns {number} Default replica count
     */
    determineDefaultReplicas(trdSpec) {
        const environment = trdSpec.deployment?.environment || 'production';
        const envDefaults = this.environmentDefaults[environment];
        
        if (envDefaults) {
            return envDefaults.replicaCount;
        }
        
        return trdSpec.resources?.replicas?.default || 1;
    }

    /**
     * Generate environment-specific value overrides
     * @param {Object} trdSpec - Parsed TRD specifications
     * @param {string} environment - Target environment
     * @returns {Object} Environment-specific values
     */
    generateEnvironmentOverrides(trdSpec, environment) {
        const baseValues = this.generateValuesYaml(trdSpec);
        const envDefaults = this.environmentDefaults[environment];
        
        if (!envDefaults) {
            return baseValues;
        }
        
        return this.mergeValues(baseValues, envDefaults);
    }

    /**
     * Merge values with environment overrides
     * @param {Object} baseValues - Base values configuration
     * @param {Object} overrides - Environment-specific overrides
     * @returns {Object} Merged values configuration
     */
    mergeValues(baseValues, overrides) {
        const merged = { ...baseValues };
        
        for (const [key, value] of Object.entries(overrides)) {
            if (typeof value === 'object' && !Array.isArray(value)) {
                merged[key] = { ...merged[key], ...value };
            } else {
                merged[key] = value;
            }
        }
        
        return merged;
    }

    /**
     * Generate values documentation for documentation-specialist
     * @param {Object} trdSpec - Parsed TRD specifications
     * @returns {string} Values documentation in Markdown format
     */
    generateValuesDocumentation(trdSpec) {
        const values = this.generateValuesYaml(trdSpec);
        
        let doc = `# Values Documentation\n\n`;
        doc += `Generated for: ${trdSpec.metadata?.project_name || 'Application'}\n`;
        doc += `Version: ${trdSpec.metadata?.version || '0.1.0'}\n`;
        doc += `Generated: ${new Date().toISOString()}\n\n`;
        
        doc += `## Configuration Categories\n\n`;
        
        for (const [category, description] of Object.entries(this.valueCategories)) {
            if (values[category]) {
                doc += `### ${category}\n\n`;
                doc += `${description}\n\n`;
                doc += this.generateValueDocumentation(category, values[category]);
                doc += `\n`;
            }
        }
        
        doc += `## Environment Overrides\n\n`;
        doc += this.generateEnvironmentDocumentation(trdSpec);
        
        return doc;
    }

    /**
     * Generate documentation for a specific value category
     * @param {string} category - Value category name
     * @param {Object} values - Values configuration for the category
     * @returns {string} Category documentation
     */
    generateValueDocumentation(category, values) {
        let doc = '```yaml\n';
        doc += `${category}:\n`;
        doc += this.formatValuesYaml(values, 2);
        doc += '```\n';
        
        return doc;
    }

    /**
     * Format values as YAML with proper indentation
     * @param {Object} values - Values to format
     * @param {number} indent - Indentation level
     * @returns {string} Formatted YAML
     */
    formatValuesYaml(values, indent = 0) {
        let yaml = '';
        const spaces = ' '.repeat(indent);
        
        for (const [key, value] of Object.entries(values)) {
            if (typeof value === 'object' && !Array.isArray(value)) {
                yaml += `${spaces}${key}:\n`;
                yaml += this.formatValuesYaml(value, indent + 2);
            } else if (Array.isArray(value)) {
                yaml += `${spaces}${key}:\n`;
                for (const item of value) {
                    if (typeof item === 'object') {
                        yaml += `${spaces}- \n`;
                        yaml += this.formatValuesYaml(item, indent + 4);
                    } else {
                        yaml += `${spaces}- ${item}\n`;
                    }
                }
            } else {
                yaml += `${spaces}${key}: ${value}\n`;
            }
        }
        
        return yaml;
    }

    /**
     * Generate environment-specific documentation
     * @param {Object} trdSpec - Parsed TRD specifications
     * @returns {string} Environment documentation
     */
    generateEnvironmentDocumentation(trdSpec) {
        let doc = '';
        
        for (const [env, defaults] of Object.entries(this.environmentDefaults)) {
            doc += `### ${env.toUpperCase()} Environment\n\n`;
            doc += '```yaml\n';
            doc += this.formatValuesYaml(defaults, 0);
            doc += '```\n\n';
        }
        
        return doc;
    }

    /**
     * Clean up values by removing empty objects and arrays
     * @param {Object} values - Values to clean up
     * @returns {Object} Cleaned values
     */
    cleanupValues(values) {
        const cleaned = {};
        
        for (const [key, value] of Object.entries(values)) {
            if (value === null || value === undefined) {
                continue;
            }
            
            if (typeof value === 'object' && !Array.isArray(value)) {
                const cleanedValue = this.cleanupValues(value);
                if (Object.keys(cleanedValue).length > 0) {
                    cleaned[key] = cleanedValue;
                }
            } else if (Array.isArray(value)) {
                if (value.length > 0) {
                    cleaned[key] = value;
                }
            } else {
                cleaned[key] = value;
            }
        }
        
        return cleaned;
    }

    /**
     * Validate naming conventions
     * @param {string} name - Name to validate
     * @param {string} convention - Naming convention to use
     * @returns {boolean} True if name follows convention
     */
    validateNamingConvention(name, convention = 'camelCase') {
        const pattern = this.namingConventions[convention];
        return pattern ? pattern.test(name) : false;
    }
}

module.exports = TemplateEngine;

// CLI usage for template generation
if (require.main === module) {
    const TRDParser = require('./trd-parser');
    const trdPath = process.argv[2];
    const environment = process.argv[3] || 'production';
    
    if (!trdPath) {
        console.error('Usage: node template-engine.js <path-to-trd-file> [environment]');
        process.exit(1);
    }
    
    async function main() {
        try {
            const parser = new TRDParser();
            const template = new TemplateEngine();
            
            const trdSpec = await parser.parseTRD(trdPath);
            const values = template.generateValuesYaml(trdSpec);
            const envValues = template.generateEnvironmentOverrides(trdSpec, environment);
            const documentation = template.generateValuesDocumentation(trdSpec);
            
            console.log('=== Base Values.yaml ===');
            console.log('# Generated by Helm Chart Specialist Agent');
            console.log(template.formatValuesYaml(values, 0));
            
            console.log('\n=== Environment Overrides (' + environment + ') ===');
            console.log(template.formatValuesYaml(envValues, 0));
            
            console.log('\n=== Values Documentation ===');
            console.log(documentation);
            
        } catch (error) {
            console.error('Error generating template configuration:', error.message);
            process.exit(1);
        }
    }
    
    main();
}