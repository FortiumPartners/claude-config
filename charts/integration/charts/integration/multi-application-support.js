#!/usr/bin/env node

/**
 * Multi-Application Support for Helm Chart Specialist
 * 
 * This module implements comprehensive multi-application templating including:
 * - Web application templates with modern frontend frameworks
 * - API service patterns for REST and GraphQL services
 * - Background worker configurations for queue processing
 * - Database deployment templates for various database systems
 * - Microservices patterns with service mesh integration
 * 
 * @version 1.0.0
 * @author General Purpose Agent (delegated by Tech Lead Orchestrator)
 * @integrates template-engine.js and advanced-templating.js for multi-app patterns
 */

const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

class MultiApplicationSupport {
    constructor() {
        this.applicationTypes = new Map();
        this.servicePatterns = new Map();
        this.deploymentStrategies = new Map();
        this.integrationPatterns = new Map();
        
        this.initializeApplicationTypes();
        this.initializeServicePatterns();
        this.initializeDeploymentStrategies();
        this.initializeIntegrationPatterns();
    }

    /**
     * Initialize comprehensive application types
     */
    initializeApplicationTypes() {
        // Web Application Templates
        this.applicationTypes.set('web-app', {
            category: 'frontend',
            description: 'Modern web applications with CDN and reverse proxy',
            frameworks: ['react', 'vue', 'angular', 'static-site'],
            defaultValues: {
                image: { repository: 'nginx', tag: '1.21-alpine' },
                service: { type: 'ClusterIP', port: 80, targetPort: 80 },
                ingress: { 
                    enabled: true, 
                    className: 'nginx',
                    annotations: {
                        'nginx.ingress.kubernetes.io/rewrite-target': '/',
                        'nginx.ingress.kubernetes.io/ssl-redirect': 'true'
                    }
                },
                resources: {
                    limits: { cpu: '200m', memory: '256Mi' },
                    requests: { cpu: '100m', memory: '128Mi' }
                },
                autoscaling: { enabled: true, minReplicas: 2, maxReplicas: 10 },
                monitoring: { enabled: true, metrics: { enabled: false } },
                cdn: { enabled: false, provider: 'cloudflare' },
                security: {
                    contentSecurityPolicy: true,
                    httpHeaders: {
                        'X-Frame-Options': 'DENY',
                        'X-Content-Type-Options': 'nosniff',
                        'Referrer-Policy': 'strict-origin-when-cross-origin'
                    }
                }
            },
            templates: {
                deployment: 'web-app-deployment.yaml',
                service: 'web-app-service.yaml',
                ingress: 'web-app-ingress.yaml',
                configmap: 'web-app-configmap.yaml'
            }
        });

        // API Service Templates
        this.applicationTypes.set('api-service', {
            category: 'backend',
            description: 'RESTful and GraphQL API services',
            frameworks: ['nodejs', 'python', 'java', 'go', 'dotnet'],
            defaultValues: {
                image: { repository: 'node', tag: '18-alpine' },
                service: { 
                    type: 'ClusterIP', 
                    port: 8080, 
                    targetPort: 8080,
                    additionalPorts: [
                        { name: 'metrics', port: 9090, targetPort: 9090, protocol: 'TCP' }
                    ]
                },
                ingress: { 
                    enabled: true,
                    paths: [
                        { path: '/api', pathType: 'Prefix' },
                        { path: '/graphql', pathType: 'Exact' }
                    ]
                },
                healthChecks: {
                    liveness: { path: '/health', port: 8080, initialDelaySeconds: 30 },
                    readiness: { path: '/ready', port: 8080, initialDelaySeconds: 5 },
                    startup: { path: '/health', port: 8080, failureThreshold: 30 }
                },
                resources: {
                    limits: { cpu: '1000m', memory: '512Mi' },
                    requests: { cpu: '200m', memory: '256Mi' }
                },
                autoscaling: { enabled: true, minReplicas: 3, maxReplicas: 20 },
                monitoring: { 
                    enabled: true, 
                    metrics: { enabled: true, port: 9090, path: '/metrics' },
                    tracing: { enabled: true, jaeger: true }
                },
                database: {
                    enabled: true,
                    type: 'postgresql',
                    connectionPooling: true
                },
                cache: {
                    enabled: true,
                    type: 'redis',
                    ttl: 300
                },
                rateLimiting: {
                    enabled: true,
                    requestsPerMinute: 1000
                }
            },
            templates: {
                deployment: 'api-service-deployment.yaml',
                service: 'api-service-service.yaml',
                ingress: 'api-service-ingress.yaml',
                configmap: 'api-service-configmap.yaml',
                hpa: 'api-service-hpa.yaml'
            }
        });

        // Background Worker Templates
        this.applicationTypes.set('background-worker', {
            category: 'worker',
            description: 'Background job processing and queue workers',
            frameworks: ['sidekiq', 'celery', 'bull', 'rq', 'hangfire'],
            defaultValues: {
                image: { repository: 'worker', tag: 'latest' },
                replicaCount: 2,
                service: { 
                    enabled: false // Workers typically don't need services
                },
                resources: {
                    limits: { cpu: '2000m', memory: '1Gi' },
                    requests: { cpu: '500m', memory: '512Mi' }
                },
                autoscaling: { 
                    enabled: true, 
                    minReplicas: 2, 
                    maxReplicas: 50,
                    metrics: [
                        { type: 'Resource', resource: { name: 'cpu', target: { type: 'Utilization', averageUtilization: 70 } } },
                        { type: 'External', external: { metric: { name: 'queue_length' }, target: { type: 'Value', value: '10' } } }
                    ]
                },
                queue: {
                    type: 'redis',
                    host: 'redis-master',
                    port: 6379,
                    database: 0
                },
                monitoring: {
                    enabled: true,
                    metrics: { enabled: true, port: 9090 },
                    deadLetterQueue: true,
                    retryPolicy: {
                        maxRetries: 3,
                        backoffStrategy: 'exponential'
                    }
                },
                env: [
                    { name: 'WORKER_CONCURRENCY', value: '10' },
                    { name: 'WORKER_TIMEOUT', value: '300' },
                    { name: 'QUEUE_NAME', value: 'default' }
                ]
            },
            templates: {
                deployment: 'background-worker-deployment.yaml',
                configmap: 'background-worker-configmap.yaml',
                hpa: 'background-worker-hpa.yaml'
            }
        });

        // Database Templates
        this.applicationTypes.set('database', {
            category: 'data',
            description: 'Database deployment templates for various systems',
            frameworks: ['postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch'],
            defaultValues: {
                image: { repository: 'postgres', tag: '13-alpine' },
                service: { 
                    type: 'ClusterIP', 
                    port: 5432, 
                    targetPort: 5432 
                },
                persistence: {
                    enabled: true,
                    storageClass: '',
                    accessMode: 'ReadWriteOnce',
                    size: '10Gi',
                    annotations: {},
                    backup: {
                        enabled: true,
                        schedule: '0 2 * * *',
                        retention: '7d'
                    }
                },
                resources: {
                    limits: { cpu: '2000m', memory: '2Gi' },
                    requests: { cpu: '500m', memory: '1Gi' }
                },
                security: {
                    passwordSecret: 'database-password',
                    tls: {
                        enabled: false,
                        certificateSecret: 'database-tls'
                    },
                    networkPolicy: {
                        enabled: true,
                        allowedPods: []
                    }
                },
                monitoring: {
                    enabled: true,
                    exporter: {
                        enabled: true,
                        image: 'postgres_exporter:latest',
                        port: 9187
                    }
                },
                backup: {
                    enabled: true,
                    strategy: 'pg_dump',
                    schedule: '0 2 * * *',
                    retention: 7
                }
            },
            templates: {
                statefulset: 'database-statefulset.yaml',
                service: 'database-service.yaml',
                pvc: 'database-pvc.yaml',
                secret: 'database-secret.yaml',
                configmap: 'database-configmap.yaml',
                cronjob: 'database-backup-cronjob.yaml'
            }
        });

        // Microservices Templates
        this.applicationTypes.set('microservice', {
            category: 'microservice',
            description: 'Microservices with service mesh integration',
            frameworks: ['istio', 'linkerd', 'consul-connect', 'envoy'],
            defaultValues: {
                image: { repository: 'microservice', tag: 'latest' },
                service: { 
                    type: 'ClusterIP', 
                    port: 8080, 
                    targetPort: 8080 
                },
                serviceMesh: {
                    enabled: true,
                    type: 'istio',
                    mtls: { mode: 'STRICT' },
                    sidecarInjection: true
                },
                resources: {
                    limits: { cpu: '500m', memory: '512Mi' },
                    requests: { cpu: '100m', memory: '128Mi' }
                },
                autoscaling: { enabled: true, minReplicas: 3, maxReplicas: 50 },
                monitoring: {
                    enabled: true,
                    serviceMonitor: true,
                    tracing: { enabled: true, samplingRate: 0.1 }
                },
                networking: {
                    destinationRule: {
                        trafficPolicy: {
                            loadBalancer: { simple: 'ROUND_ROBIN' },
                            connectionPool: {
                                tcp: { maxConnections: 100 },
                                http: { http1MaxPendingRequests: 50, maxRequestsPerConnection: 2 }
                            }
                        }
                    },
                    virtualService: {
                        routes: [
                            { match: [{ uri: { prefix: '/' } }], route: [{ destination: { host: 'microservice' } }] }
                        ]
                    }
                },
                security: {
                    peerAuthentication: { mtls: { mode: 'STRICT' } },
                    authorizationPolicy: {
                        enabled: true,
                        rules: []
                    }
                }
            },
            templates: {
                deployment: 'microservice-deployment.yaml',
                service: 'microservice-service.yaml',
                destinationrule: 'microservice-destinationrule.yaml',
                virtualservice: 'microservice-virtualservice.yaml',
                peerauthentication: 'microservice-peerauthentication.yaml',
                authorizationpolicy: 'microservice-authorizationpolicy.yaml'
            }
        });
    }

    /**
     * Initialize service patterns for different application types
     */
    initializeServicePatterns() {
        this.servicePatterns.set('load-balancer', {
            description: 'External load balancer service',
            serviceType: 'LoadBalancer',
            annotations: {
                'service.beta.kubernetes.io/aws-load-balancer-type': 'nlb',
                'service.beta.kubernetes.io/aws-load-balancer-cross-zone-load-balancing-enabled': 'true'
            }
        });

        this.servicePatterns.set('cluster-ip', {
            description: 'Internal cluster service',
            serviceType: 'ClusterIP',
            annotations: {}
        });

        this.servicePatterns.set('headless', {
            description: 'Headless service for StatefulSets',
            serviceType: 'ClusterIP',
            clusterIP: 'None',
            annotations: {}
        });

        this.servicePatterns.set('nodeport', {
            description: 'NodePort service for development',
            serviceType: 'NodePort',
            nodePort: 30080,
            annotations: {}
        });
    }

    /**
     * Initialize deployment strategies
     */
    initializeDeploymentStrategies() {
        this.deploymentStrategies.set('rolling-update', {
            type: 'RollingUpdate',
            rollingUpdate: {
                maxUnavailable: '25%',
                maxSurge: '25%'
            }
        });

        this.deploymentStrategies.set('recreate', {
            type: 'Recreate'
        });

        this.deploymentStrategies.set('canary', {
            type: 'RollingUpdate',
            rollingUpdate: {
                maxUnavailable: 0,
                maxSurge: '10%'
            },
            canary: {
                enabled: true,
                steps: [
                    { setWeight: 10, pause: { duration: '2m' } },
                    { setWeight: 50, pause: { duration: '5m' } },
                    { setWeight: 100 }
                ]
            }
        });

        this.deploymentStrategies.set('blue-green', {
            type: 'BlueGreen',
            blueGreen: {
                activeService: 'active',
                previewService: 'preview',
                autoPromotionEnabled: false,
                prePromotionAnalysis: {
                    templates: ['success-rate'],
                    args: [{ name: 'service-name', value: 'microservice' }]
                }
            }
        });
    }

    /**
     * Initialize integration patterns
     */
    initializeIntegrationPatterns() {
        this.integrationPatterns.set('database-integration', {
            type: 'database',
            patterns: {
                'connection-pool': {
                    maxConnections: 20,
                    idleTimeout: 300,
                    connectionTimeout: 30
                },
                'migration': {
                    enabled: true,
                    job: 'pre-install,pre-upgrade',
                    image: 'migrate/migrate'
                },
                'backup': {
                    enabled: true,
                    schedule: '0 2 * * *',
                    retention: 7
                }
            }
        });

        this.integrationPatterns.set('cache-integration', {
            type: 'cache',
            patterns: {
                'redis': {
                    cluster: true,
                    password: true,
                    persistence: false
                },
                'memcached': {
                    maxMemory: '256m',
                    threads: 4
                }
            }
        });

        this.integrationPatterns.set('message-queue', {
            type: 'messaging',
            patterns: {
                'rabbitmq': {
                    ha: true,
                    persistence: true,
                    clustering: true
                },
                'kafka': {
                    replication: 3,
                    partitions: 12,
                    retention: '7d'
                }
            }
        });
    }

    /**
     * Generate application-specific templates
     * @param {string} applicationType - Type of application
     * @param {Object} customValues - Custom values override
     * @returns {Object} Generated templates and configurations
     */
    generateApplicationTemplates(applicationType, customValues = {}) {
        console.log(`🏗️ Generating templates for ${applicationType}...`);
        
        const appConfig = this.applicationTypes.get(applicationType);
        if (!appConfig) {
            throw new Error(`Unknown application type: ${applicationType}`);
        }

        const mergedValues = this.mergeValues(appConfig.defaultValues, customValues);
        const templates = {};

        // Generate each template file for the application type
        for (const [resourceType, templateFile] of Object.entries(appConfig.templates)) {
            templates[templateFile] = this.generateTemplateContent(resourceType, mergedValues, appConfig);
        }

        // Generate values.yaml specific to this application type
        const valuesYaml = this.generateApplicationValues(appConfig, mergedValues);

        return {
            applicationType: applicationType,
            category: appConfig.category,
            description: appConfig.description,
            frameworks: appConfig.frameworks,
            templates: templates,
            values: valuesYaml,
            deployment: {
                strategy: this.selectDeploymentStrategy(applicationType, mergedValues),
                service: this.selectServicePattern(applicationType, mergedValues)
            },
            integrations: this.generateIntegrations(applicationType, mergedValues)
        };
    }

    /**
     * Generate web application template
     * @param {Object} values - Configuration values
     * @returns {string} Web application deployment template
     */
    generateWebAppDeployment(values) {
        return `apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "chart.fullname" . }}
  labels:
    {{- include "chart.labels" . | nindent 4 }}
    app.kubernetes.io/component: web-app
spec:
  {{- if not .Values.autoscaling.enabled }}
  replicas: {{ .Values.replicaCount }}
  {{- end }}
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 25%
      maxSurge: 25%
  selector:
    matchLabels:
      {{- include "chart.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      annotations:
        checksum/config: {{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}
        {{- with .Values.podAnnotations }}
        {{- toYaml . | nindent 8 }}
        {{- end }}
      labels:
        {{- include "chart.selectorLabels" . | nindent 8 }}
        app.kubernetes.io/component: web-app
    spec:
      {{- with .Values.imagePullSecrets }}
      imagePullSecrets:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      serviceAccountName: {{ include "chart.serviceAccountName" . }}
      securityContext:
        {{- toYaml .Values.podSecurityContext | nindent 8 }}
      containers:
        - name: {{ .Chart.Name }}
          securityContext:
            {{- toYaml .Values.securityContext | nindent 12 }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - name: http
              containerPort: {{ .Values.service.targetPort }}
              protocol: TCP
          livenessProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /ready
              port: http
            initialDelaySeconds: 5
            periodSeconds: 5
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
          {{- if .Values.env }}
          env:
            {{- toYaml .Values.env | nindent 12 }}
          {{- end }}
          volumeMounts:
            - name: nginx-config
              mountPath: /etc/nginx/conf.d
              readOnly: true
            {{- if .Values.cdn.enabled }}
            - name: cdn-config
              mountPath: /etc/nginx/cdn.conf
              subPath: cdn.conf
              readOnly: true
            {{- end }}
      volumes:
        - name: nginx-config
          configMap:
            name: {{ include "chart.fullname" . }}-nginx
        {{- if .Values.cdn.enabled }}
        - name: cdn-config
          configMap:
            name: {{ include "chart.fullname" . }}-cdn
        {{- end }}
      {{- with .Values.nodeSelector }}
      nodeSelector:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.affinity }}
      affinity:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.tolerations }}
      tolerations:
        {{- toYaml . | nindent 8 }}
      {{- end }}`;
    }

    /**
     * Generate API service deployment template
     * @param {Object} values - Configuration values
     * @returns {string} API service deployment template
     */
    generateApiServiceDeployment(values) {
        return `apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "chart.fullname" . }}
  labels:
    {{- include "chart.labels" . | nindent 4 }}
    app.kubernetes.io/component: api-service
spec:
  {{- if not .Values.autoscaling.enabled }}
  replicas: {{ .Values.replicaCount }}
  {{- end }}
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 25%
      maxSurge: 25%
  selector:
    matchLabels:
      {{- include "chart.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      annotations:
        checksum/config: {{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}
        {{- if .Values.monitoring.enabled }}
        prometheus.io/scrape: "true"
        prometheus.io/port: "{{ .Values.monitoring.metrics.port }}"
        prometheus.io/path: "{{ .Values.monitoring.metrics.path }}"
        {{- end }}
        {{- with .Values.podAnnotations }}
        {{- toYaml . | nindent 8 }}
        {{- end }}
      labels:
        {{- include "chart.selectorLabels" . | nindent 8 }}
        app.kubernetes.io/component: api-service
    spec:
      {{- with .Values.imagePullSecrets }}
      imagePullSecrets:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      serviceAccountName: {{ include "chart.serviceAccountName" . }}
      securityContext:
        {{- toYaml .Values.podSecurityContext | nindent 8 }}
      initContainers:
        {{- if .Values.database.enabled }}
        - name: wait-for-database
          image: busybox:1.35
          command: ['sh', '-c', 'until nc -z {{ .Values.database.host }} {{ .Values.database.port }}; do echo waiting for database; sleep 2; done;']
        {{- end }}
        {{- if .Values.cache.enabled }}
        - name: wait-for-cache
          image: busybox:1.35
          command: ['sh', '-c', 'until nc -z {{ .Values.cache.host }} {{ .Values.cache.port }}; do echo waiting for cache; sleep 2; done;']
        {{- end }}
      containers:
        - name: {{ .Chart.Name }}
          securityContext:
            {{- toYaml .Values.securityContext | nindent 12 }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - name: http
              containerPort: {{ .Values.service.targetPort }}
              protocol: TCP
            {{- if .Values.monitoring.metrics.enabled }}
            - name: metrics
              containerPort: {{ .Values.monitoring.metrics.port }}
              protocol: TCP
            {{- end }}
          livenessProbe:
            httpGet:
              path: {{ .Values.healthChecks.liveness.path }}
              port: http
            initialDelaySeconds: {{ .Values.healthChecks.liveness.initialDelaySeconds }}
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: {{ .Values.healthChecks.readiness.path }}
              port: http
            initialDelaySeconds: {{ .Values.healthChecks.readiness.initialDelaySeconds }}
            periodSeconds: 5
            timeoutSeconds: 5
            failureThreshold: 3
          startupProbe:
            httpGet:
              path: {{ .Values.healthChecks.startup.path }}
              port: http
            initialDelaySeconds: 0
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: {{ .Values.healthChecks.startup.failureThreshold }}
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
          env:
            {{- if .Values.database.enabled }}
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: {{ include "chart.fullname" . }}-database
                  key: url
            {{- end }}
            {{- if .Values.cache.enabled }}
            - name: CACHE_URL
              valueFrom:
                secretKeyRef:
                  name: {{ include "chart.fullname" . }}-cache
                  key: url
            {{- end }}
            {{- range .Values.env }}
            - name: {{ .name }}
              value: {{ .value | quote }}
            {{- end }}
          volumeMounts:
            - name: config
              mountPath: /app/config
              readOnly: true
      volumes:
        - name: config
          configMap:
            name: {{ include "chart.fullname" . }}
      {{- with .Values.nodeSelector }}
      nodeSelector:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.affinity }}
      affinity:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.tolerations }}
      tolerations:
        {{- toYaml . | nindent 8 }}
      {{- end }}`;
    }

    /**
     * Generate background worker deployment template
     * @param {Object} values - Configuration values
     * @returns {string} Background worker deployment template
     */
    generateBackgroundWorkerDeployment(values) {
        return `apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "chart.fullname" . }}
  labels:
    {{- include "chart.labels" . | nindent 4 }}
    app.kubernetes.io/component: background-worker
spec:
  {{- if not .Values.autoscaling.enabled }}
  replicas: {{ .Values.replicaCount }}
  {{- end }}
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 50%
      maxSurge: 0
  selector:
    matchLabels:
      {{- include "chart.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      annotations:
        checksum/config: {{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}
        {{- if .Values.monitoring.enabled }}
        prometheus.io/scrape: "true"
        prometheus.io/port: "{{ .Values.monitoring.metrics.port }}"
        prometheus.io/path: "/metrics"
        {{- end }}
        {{- with .Values.podAnnotations }}
        {{- toYaml . | nindent 8 }}
        {{- end }}
      labels:
        {{- include "chart.selectorLabels" . | nindent 8 }}
        app.kubernetes.io/component: background-worker
    spec:
      {{- with .Values.imagePullSecrets }}
      imagePullSecrets:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      serviceAccountName: {{ include "chart.serviceAccountName" . }}
      securityContext:
        {{- toYaml .Values.podSecurityContext | nindent 8 }}
      initContainers:
        - name: wait-for-queue
          image: busybox:1.35
          command: ['sh', '-c', 'until nc -z {{ .Values.queue.host }} {{ .Values.queue.port }}; do echo waiting for queue; sleep 2; done;']
      containers:
        - name: {{ .Chart.Name }}
          securityContext:
            {{- toYaml .Values.securityContext | nindent 12 }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          {{- if .Values.monitoring.metrics.enabled }}
          ports:
            - name: metrics
              containerPort: {{ .Values.monitoring.metrics.port }}
              protocol: TCP
          {{- end }}
          livenessProbe:
            exec:
              command:
                - /bin/sh
                - -c
                - "ps aux | grep -v grep | grep worker"
            initialDelaySeconds: 30
            periodSeconds: 30
          readinessProbe:
            exec:
              command:
                - /bin/sh
                - -c
                - "ps aux | grep -v grep | grep worker"
            initialDelaySeconds: 5
            periodSeconds: 10
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
          env:
            - name: QUEUE_HOST
              value: {{ .Values.queue.host | quote }}
            - name: QUEUE_PORT
              value: {{ .Values.queue.port | quote }}
            - name: QUEUE_DATABASE
              value: {{ .Values.queue.database | quote }}
            {{- range .Values.env }}
            - name: {{ .name }}
              value: {{ .value | quote }}
            {{- end }}
          volumeMounts:
            - name: config
              mountPath: /app/config
              readOnly: true
      volumes:
        - name: config
          configMap:
            name: {{ include "chart.fullname" . }}
      {{- with .Values.nodeSelector }}
      nodeSelector:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.affinity }}
      affinity:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.tolerations }}
      tolerations:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      terminationGracePeriodSeconds: 60`;
    }

    /**
     * Generate database StatefulSet template
     * @param {Object} values - Configuration values
     * @returns {string} Database StatefulSet template
     */
    generateDatabaseStatefulSet(values) {
        return `apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: {{ include "chart.fullname" . }}
  labels:
    {{- include "chart.labels" . | nindent 4 }}
    app.kubernetes.io/component: database
spec:
  serviceName: {{ include "chart.fullname" . }}-headless
  replicas: 1
  selector:
    matchLabels:
      {{- include "chart.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      annotations:
        checksum/config: {{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}
        {{- with .Values.podAnnotations }}
        {{- toYaml . | nindent 8 }}
        {{- end }}
      labels:
        {{- include "chart.selectorLabels" . | nindent 8 }}
        app.kubernetes.io/component: database
    spec:
      serviceAccountName: {{ include "chart.serviceAccountName" . }}
      securityContext:
        fsGroup: 999
        runAsUser: 999
        runAsGroup: 999
        runAsNonRoot: true
      containers:
        - name: database
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - name: database
              containerPort: {{ .Values.service.targetPort }}
              protocol: TCP
          livenessProbe:
            exec:
              command:
                - /bin/sh
                - -c
                - pg_isready -U postgres
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            exec:
              command:
                - /bin/sh
                - -c
                - pg_isready -U postgres
            initialDelaySeconds: 5
            periodSeconds: 5
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
          env:
            - name: POSTGRES_DB
              valueFrom:
                secretKeyRef:
                  name: {{ include "chart.fullname" . }}
                  key: database
            - name: POSTGRES_USER
              valueFrom:
                secretKeyRef:
                  name: {{ include "chart.fullname" . }}
                  key: username
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: {{ include "chart.fullname" . }}
                  key: password
            - name: PGDATA
              value: /var/lib/postgresql/data/pgdata
          volumeMounts:
            - name: data
              mountPath: /var/lib/postgresql/data
            - name: config
              mountPath: /etc/postgresql/postgresql.conf
              subPath: postgresql.conf
        {{- if .Values.monitoring.exporter.enabled }}
        - name: exporter
          image: {{ .Values.monitoring.exporter.image }}
          ports:
            - name: metrics
              containerPort: {{ .Values.monitoring.exporter.port }}
              protocol: TCP
          env:
            - name: DATA_SOURCE_NAME
              value: "postgresql://postgres:$(POSTGRES_PASSWORD)@localhost:5432/postgres?sslmode=disable"
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: {{ include "chart.fullname" . }}
                  key: password
          resources:
            limits:
              cpu: 100m
              memory: 128Mi
            requests:
              cpu: 50m
              memory: 64Mi
        {{- end }}
      volumes:
        - name: config
          configMap:
            name: {{ include "chart.fullname" . }}
  {{- if .Values.persistence.enabled }}
  volumeClaimTemplates:
    - metadata:
        name: data
        {{- with .Values.persistence.annotations }}
        annotations:
          {{- toYaml . | nindent 10 }}
        {{- end }}
        {{- with .Values.persistence.labels }}
        labels:
          {{- toYaml . | nindent 10 }}
        {{- end }}
      spec:
        accessModes:
          - {{ .Values.persistence.accessMode | quote }}
        resources:
          requests:
            storage: {{ .Values.persistence.size | quote }}
        {{- if .Values.persistence.storageClass }}
        storageClassName: {{ .Values.persistence.storageClass | quote }}
        {{- end }}
  {{- end }}`;
    }

    /**
     * Generate microservice deployment with service mesh
     * @param {Object} values - Configuration values
     * @returns {string} Microservice deployment template
     */
    generateMicroserviceDeployment(values) {
        return `apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "chart.fullname" . }}
  labels:
    {{- include "chart.labels" . | nindent 4 }}
    app.kubernetes.io/component: microservice
spec:
  {{- if not .Values.autoscaling.enabled }}
  replicas: {{ .Values.replicaCount }}
  {{- end }}
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 25%
      maxSurge: 25%
  selector:
    matchLabels:
      {{- include "chart.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      annotations:
        checksum/config: {{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}
        {{- if .Values.serviceMesh.sidecarInjection }}
        sidecar.istio.io/inject: "true"
        {{- end }}
        {{- if .Values.monitoring.enabled }}
        prometheus.io/scrape: "true"
        prometheus.io/port: "8080"
        prometheus.io/path: "/metrics"
        {{- end }}
        {{- with .Values.podAnnotations }}
        {{- toYaml . | nindent 8 }}
        {{- end }}
      labels:
        {{- include "chart.selectorLabels" . | nindent 8 }}
        app.kubernetes.io/component: microservice
        version: {{ .Chart.AppVersion | quote }}
    spec:
      {{- with .Values.imagePullSecrets }}
      imagePullSecrets:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      serviceAccountName: {{ include "chart.serviceAccountName" . }}
      securityContext:
        {{- toYaml .Values.podSecurityContext | nindent 8 }}
      containers:
        - name: {{ .Chart.Name }}
          securityContext:
            {{- toYaml .Values.securityContext | nindent 12 }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - name: http
              containerPort: {{ .Values.service.targetPort }}
              protocol: TCP
          livenessProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /ready
              port: http
            initialDelaySeconds: 5
            periodSeconds: 5
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
          env:
            - name: SERVICE_NAME
              value: {{ include "chart.fullname" . }}
            - name: SERVICE_VERSION
              value: {{ .Chart.AppVersion | quote }}
            {{- if .Values.serviceMesh.enabled }}
            - name: JAEGER_AGENT_HOST
              value: "jaeger-agent.istio-system.svc.cluster.local"
            - name: JAEGER_AGENT_PORT
              value: "6831"
            {{- end }}
            {{- range .Values.env }}
            - name: {{ .name }}
              value: {{ .value | quote }}
            {{- end }}
          volumeMounts:
            - name: config
              mountPath: /app/config
              readOnly: true
      volumes:
        - name: config
          configMap:
            name: {{ include "chart.fullname" . }}
      {{- with .Values.nodeSelector }}
      nodeSelector:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.affinity }}
      affinity:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.tolerations }}
      tolerations:
        {{- toYaml . | nindent 8 }}
      {{- end }}`;
    }

    /**
     * Generate template content based on resource type
     * @param {string} resourceType - Type of Kubernetes resource
     * @param {Object} values - Configuration values
     * @param {Object} appConfig - Application configuration
     * @returns {string} Generated template content
     */
    generateTemplateContent(resourceType, values, appConfig) {
        const templateGenerators = {
            'deployment': () => {
                if (appConfig.category === 'frontend') return this.generateWebAppDeployment(values);
                if (appConfig.category === 'backend') return this.generateApiServiceDeployment(values);
                if (appConfig.category === 'worker') return this.generateBackgroundWorkerDeployment(values);
                if (appConfig.category === 'microservice') return this.generateMicroserviceDeployment(values);
                return this.generateGenericDeployment(values);
            },
            'statefulset': () => this.generateDatabaseStatefulSet(values),
            'service': () => this.generateServiceTemplate(resourceType, values, appConfig),
            'ingress': () => this.generateIngressTemplate(resourceType, values, appConfig),
            'configmap': () => this.generateConfigMapTemplate(resourceType, values, appConfig),
            'secret': () => this.generateSecretTemplate(resourceType, values, appConfig),
            'hpa': () => this.generateHPATemplate(resourceType, values, appConfig),
            'pvc': () => this.generatePVCTemplate(resourceType, values, appConfig),
            'cronjob': () => this.generateCronJobTemplate(resourceType, values, appConfig),
            'destinationrule': () => this.generateDestinationRuleTemplate(values),
            'virtualservice': () => this.generateVirtualServiceTemplate(values),
            'peerauthentication': () => this.generatePeerAuthenticationTemplate(values),
            'authorizationpolicy': () => this.generateAuthorizationPolicyTemplate(values)
        };

        const generator = templateGenerators[resourceType];
        if (!generator) {
            throw new Error(`No template generator found for resource type: ${resourceType}`);
        }

        return generator();
    }

    /**
     * Generate service template for different application types
     * @param {string} resourceType - Resource type
     * @param {Object} values - Configuration values
     * @param {Object} appConfig - Application configuration
     * @returns {string} Service template
     */
    generateServiceTemplate(resourceType, values, appConfig) {
        return `apiVersion: v1
kind: Service
metadata:
  name: {{ include "chart.fullname" . }}
  labels:
    {{- include "chart.labels" . | nindent 4 }}
    app.kubernetes.io/component: ${appConfig.category}
  {{- with .Values.service.annotations }}
  annotations:
    {{- toYaml . | nindent 4 }}
  {{- end }}
spec:
  type: {{ .Values.service.type }}
  ports:
    - port: {{ .Values.service.port }}
      targetPort: {{ .Values.service.targetPort }}
      protocol: TCP
      name: http
    {{- range .Values.service.additionalPorts }}
    - port: {{ .port }}
      targetPort: {{ .targetPort }}
      protocol: {{ .protocol | default "TCP" }}
      name: {{ .name }}
    {{- end }}
  selector:
    {{- include "chart.selectorLabels" . | nindent 4 }}`;
    }

    /**
     * Generate comprehensive values.yaml for application type
     * @param {Object} appConfig - Application configuration
     * @param {Object} mergedValues - Merged configuration values
     * @returns {Object} Generated values configuration
     */
    generateApplicationValues(appConfig, mergedValues) {
        const values = {
            // Standard Helm chart values
            nameOverride: '',
            fullnameOverride: '',
            
            // Application-specific configuration
            ...mergedValues,
            
            // Add application type metadata
            application: {
                type: appConfig.category,
                frameworks: appConfig.frameworks,
                description: appConfig.description
            }
        };

        // Add category-specific configurations
        if (appConfig.category === 'frontend') {
            values.cdn = values.cdn || { enabled: false };
            values.security = values.security || {};
        } else if (appConfig.category === 'backend') {
            values.database = values.database || { enabled: false };
            values.cache = values.cache || { enabled: false };
            values.rateLimiting = values.rateLimiting || { enabled: false };
        } else if (appConfig.category === 'worker') {
            values.queue = values.queue || { type: 'redis' };
            values.monitoring = values.monitoring || { deadLetterQueue: true };
        } else if (appConfig.category === 'data') {
            values.persistence = values.persistence || { enabled: true };
            values.backup = values.backup || { enabled: true };
        } else if (appConfig.category === 'microservice') {
            values.serviceMesh = values.serviceMesh || { enabled: false };
            values.networking = values.networking || {};
        }

        return values;
    }

    /**
     * Select deployment strategy based on application type
     * @param {string} applicationType - Application type
     * @param {Object} values - Configuration values
     * @returns {Object} Selected deployment strategy
     */
    selectDeploymentStrategy(applicationType, values) {
        // Default strategies by application type
        const defaultStrategies = {
            'web-app': 'rolling-update',
            'api-service': 'rolling-update',
            'background-worker': 'recreate',
            'database': 'recreate',
            'microservice': 'canary'
        };

        const strategyName = values.deploymentStrategy || defaultStrategies[applicationType] || 'rolling-update';
        return this.deploymentStrategies.get(strategyName);
    }

    /**
     * Select service pattern based on application type
     * @param {string} applicationType - Application type
     * @param {Object} values - Configuration values
     * @returns {Object} Selected service pattern
     */
    selectServicePattern(applicationType, values) {
        // Default service patterns by application type
        const defaultPatterns = {
            'web-app': 'cluster-ip',
            'api-service': 'cluster-ip',
            'background-worker': null, // No service needed
            'database': 'headless',
            'microservice': 'cluster-ip'
        };

        const patternName = values.servicePattern || defaultPatterns[applicationType];
        return patternName ? this.servicePatterns.get(patternName) : null;
    }

    /**
     * Generate integrations for application type
     * @param {string} applicationType - Application type
     * @param {Object} values - Configuration values
     * @returns {Array} Integration configurations
     */
    generateIntegrations(applicationType, values) {
        const integrations = [];

        // Add integrations based on application requirements
        if (values.database && values.database.enabled) {
            integrations.push(this.integrationPatterns.get('database-integration'));
        }

        if (values.cache && values.cache.enabled) {
            integrations.push(this.integrationPatterns.get('cache-integration'));
        }

        if (values.queue && applicationType === 'background-worker') {
            integrations.push(this.integrationPatterns.get('message-queue'));
        }

        return integrations;
    }

    /**
     * Merge values with precedence
     * @param {Object} defaultValues - Default values
     * @param {Object} customValues - Custom values
     * @returns {Object} Merged values
     */
    mergeValues(defaultValues, customValues) {
        const merged = JSON.parse(JSON.stringify(defaultValues));
        
        for (const [key, value] of Object.entries(customValues)) {
            if (typeof value === 'object' && !Array.isArray(value) && merged[key] && typeof merged[key] === 'object') {
                merged[key] = this.mergeValues(merged[key], value);
            } else {
                merged[key] = value;
            }
        }
        
        return merged;
    }

    /**
     * Generate generic deployment template
     * @param {Object} values - Configuration values
     * @returns {string} Generic deployment template
     */
    generateGenericDeployment(values) {
        return `apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "chart.fullname" . }}
  labels:
    {{- include "chart.labels" . | nindent 4 }}
spec:
  {{- if not .Values.autoscaling.enabled }}
  replicas: {{ .Values.replicaCount }}
  {{- end }}
  selector:
    matchLabels:
      {{- include "chart.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "chart.selectorLabels" . | nindent 8 }}
    spec:
      containers:
        - name: {{ .Chart.Name }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - name: http
              containerPort: {{ .Values.service.targetPort }}
              protocol: TCP
          resources:
            {{- toYaml .Values.resources | nindent 12 }}`;
    }

    /**
     * Generate additional template methods for other resource types
     */
    generateConfigMapTemplate(resourceType, values, appConfig) {
        return `apiVersion: v1
kind: ConfigMap
metadata:
  name: {{ include "chart.fullname" . }}
  labels:
    {{- include "chart.labels" . | nindent 4 }}
data:
  application.yml: |
    server:
      port: {{ .Values.service.targetPort }}
    {{- if .Values.database.enabled }}
    database:
      host: {{ .Values.database.host }}
      port: {{ .Values.database.port }}
      name: {{ .Values.database.database }}
    {{- end }}
    {{- if .Values.cache.enabled }}
    cache:
      host: {{ .Values.cache.host }}
      port: {{ .Values.cache.port }}
      ttl: {{ .Values.cache.ttl }}
    {{- end }}`;
    }

    generateSecretTemplate(resourceType, values, appConfig) {
        return `apiVersion: v1
kind: Secret
metadata:
  name: {{ include "chart.fullname" . }}
  labels:
    {{- include "chart.labels" . | nindent 4 }}
type: Opaque
data:
  {{- if .Values.database.enabled }}
  database-password: {{ .Values.database.password | b64enc }}
  database-url: {{ printf "%s://%s:%s@%s:%s/%s" .Values.database.type .Values.database.username .Values.database.password .Values.database.host (.Values.database.port | toString) .Values.database.database | b64enc }}
  {{- end }}
  {{- range $key, $value := .Values.secrets }}
  {{ $key }}: {{ $value | b64enc }}
  {{- end }}`;
    }

    generateHPATemplate(resourceType, values, appConfig) {
        return `apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: {{ include "chart.fullname" . }}
  labels:
    {{- include "chart.labels" . | nindent 4 }}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: {{ include "chart.fullname" . }}
  minReplicas: {{ .Values.autoscaling.minReplicas }}
  maxReplicas: {{ .Values.autoscaling.maxReplicas }}
  metrics:
    {{- if .Values.autoscaling.targetCPUUtilizationPercentage }}
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: {{ .Values.autoscaling.targetCPUUtilizationPercentage }}
    {{- end }}
    {{- if .Values.autoscaling.targetMemoryUtilizationPercentage }}
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: {{ .Values.autoscaling.targetMemoryUtilizationPercentage }}
    {{- end }}
    {{- range .Values.autoscaling.metrics }}
    - {{- toYaml . | nindent 6 }}
    {{- end }}`;
    }

    generateIngressTemplate(resourceType, values, appConfig) {
        return `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{ include "chart.fullname" . }}
  labels:
    {{- include "chart.labels" . | nindent 4 }}
  {{- with .Values.ingress.annotations }}
  annotations:
    {{- toYaml . | nindent 4 }}
  {{- end }}
spec:
  {{- if .Values.ingress.className }}
  ingressClassName: {{ .Values.ingress.className }}
  {{- end }}
  {{- if .Values.ingress.tls }}
  tls:
    {{- range .Values.ingress.tls }}
    - hosts:
        {{- range .hosts }}
        - {{ . | quote }}
        {{- end }}
      secretName: {{ .secretName }}
    {{- end }}
  {{- end }}
  rules:
    {{- range .Values.ingress.hosts }}
    - host: {{ .host | quote }}
      http:
        paths:
          {{- range .paths }}
          - path: {{ .path }}
            pathType: {{ .pathType }}
            backend:
              service:
                name: {{ include "chart.fullname" $ }}
                port:
                  number: {{ $.Values.service.port }}
          {{- end }}
    {{- end }}`;
    }

    generatePVCTemplate(resourceType, values, appConfig) {
        return `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: {{ include "chart.fullname" . }}-data
  labels:
    {{- include "chart.labels" . | nindent 4 }}
  {{- with .Values.persistence.annotations }}
  annotations:
    {{- toYaml . | nindent 4 }}
  {{- end }}
spec:
  accessModes:
    - {{ .Values.persistence.accessMode }}
  resources:
    requests:
      storage: {{ .Values.persistence.size }}
  {{- if .Values.persistence.storageClass }}
  storageClassName: {{ .Values.persistence.storageClass }}
  {{- end }}`;
    }

    generateCronJobTemplate(resourceType, values, appConfig) {
        return `apiVersion: batch/v1
kind: CronJob
metadata:
  name: {{ include "chart.fullname" . }}-backup
  labels:
    {{- include "chart.labels" . | nindent 4 }}
spec:
  schedule: {{ .Values.backup.schedule | quote }}
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: postgres:13-alpine
            command:
            - /bin/sh
            - -c
            - pg_dump $DATABASE_URL | gzip > /backup/backup-$(date +%Y%m%d-%H%M%S).sql.gz
            env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: {{ include "chart.fullname" . }}
                  key: database-url
            volumeMounts:
            - name: backup-storage
              mountPath: /backup
          volumes:
          - name: backup-storage
            persistentVolumeClaim:
              claimName: {{ include "chart.fullname" . }}-backup
          restartPolicy: OnFailure`;
    }

    // Service Mesh Templates
    generateDestinationRuleTemplate(values) {
        return `apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: {{ include "chart.fullname" . }}
  labels:
    {{- include "chart.labels" . | nindent 4 }}
spec:
  host: {{ include "chart.fullname" . }}
  trafficPolicy:
    {{- toYaml .Values.networking.destinationRule.trafficPolicy | nindent 4 }}`;
    }

    generateVirtualServiceTemplate(values) {
        return `apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: {{ include "chart.fullname" . }}
  labels:
    {{- include "chart.labels" . | nindent 4 }}
spec:
  hosts:
  - {{ include "chart.fullname" . }}
  http:
  {{- toYaml .Values.networking.virtualService.routes | nindent 2 }}`;
    }

    generatePeerAuthenticationTemplate(values) {
        return `apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: {{ include "chart.fullname" . }}
  labels:
    {{- include "chart.labels" . | nindent 4 }}
spec:
  selector:
    matchLabels:
      {{- include "chart.selectorLabels" . | nindent 6 }}
  {{- toYaml .Values.security.peerAuthentication | nindent 2 }}`;
    }

    generateAuthorizationPolicyTemplate(values) {
        return `apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: {{ include "chart.fullname" . }}
  labels:
    {{- include "chart.labels" . | nindent 4 }}
spec:
  selector:
    matchLabels:
      {{- include "chart.selectorLabels" . | nindent 6 }}
  {{- if .Values.security.authorizationPolicy.rules }}
  rules:
  {{- toYaml .Values.security.authorizationPolicy.rules | nindent 2 }}
  {{- end }}`;
    }

    /**
     * Generate comprehensive multi-application chart
     * @param {Array} applications - List of applications to include
     * @param {Object} options - Generation options
     * @returns {Object} Complete multi-application chart
     */
    generateMultiApplicationChart(applications, options = {}) {
        console.log(`🏗️ Generating multi-application chart with ${applications.length} applications...`);
        
        const chart = {
            metadata: {
                name: options.chartName || 'multi-app-chart',
                version: options.version || '0.1.0',
                appVersion: options.appVersion || '1.0.0',
                description: 'Multi-application Helm chart with integrated services'
            },
            applications: [],
            sharedResources: {},
            dependencies: [],
            templates: {},
            values: {}
        };

        // Generate templates for each application
        for (const appConfig of applications) {
            const appTemplates = this.generateApplicationTemplates(appConfig.type, appConfig.values);
            chart.applications.push(appTemplates);
            
            // Merge templates with namespace prefixes
            const prefix = appConfig.name || appConfig.type;
            for (const [filename, content] of Object.entries(appTemplates.templates)) {
                chart.templates[`${prefix}-${filename}`] = content;
            }
            
            // Merge values under application namespace
            chart.values[prefix] = appTemplates.values;
        }

        // Generate shared resources
        chart.sharedResources = this.generateSharedResources(applications, options);
        
        // Analyze dependencies
        chart.dependencies = this.analyzeDependencies(applications);

        console.log(`✅ Generated multi-application chart with ${Object.keys(chart.templates).length} templates`);
        return chart;
    }

    /**
     * Generate shared resources for multi-application deployment
     * @param {Array} applications - List of applications
     * @param {Object} options - Generation options
     * @returns {Object} Shared resources
     */
    generateSharedResources(applications, options) {
        const sharedResources = {
            namespace: this.generateNamespaceTemplate(options),
            networkPolicies: this.generateSharedNetworkPolicies(applications),
            serviceMonitor: this.generateSharedServiceMonitor(applications),
            ingress: this.generateSharedIngress(applications, options)
        };

        return sharedResources;
    }

    /**
     * Generate namespace template
     * @param {Object} options - Options
     * @returns {string} Namespace template
     */
    generateNamespaceTemplate(options) {
        return `apiVersion: v1
kind: Namespace
metadata:
  name: {{ .Values.namespace | default .Release.Namespace }}
  labels:
    name: {{ .Values.namespace | default .Release.Namespace }}
    app.kubernetes.io/managed-by: {{ .Release.Service }}`;
    }

    /**
     * Analyze dependencies between applications
     * @param {Array} applications - List of applications
     * @returns {Array} Dependency analysis
     */
    analyzeDependencies(applications) {
        const dependencies = [];
        
        for (const app of applications) {
            if (app.values && app.values.database && app.values.database.enabled) {
                const dbApp = applications.find(a => a.type === 'database');
                if (dbApp) {
                    dependencies.push({
                        from: app.name || app.type,
                        to: dbApp.name || 'database',
                        type: 'database',
                        required: true
                    });
                }
            }
            
            if (app.values && app.values.cache && app.values.cache.enabled) {
                dependencies.push({
                    from: app.name || app.type,
                    to: 'redis',
                    type: 'cache',
                    required: false
                });
            }
        }
        
        return dependencies;
    }

    /**
     * Generate shared network policies
     * @param {Array} applications - List of applications
     * @returns {string} Shared network policies template
     */
    generateSharedNetworkPolicies(applications) {
        return `# Shared network policies for multi-application deployment
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: {{ .Release.Name }}-default-deny
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: {{ .Release.Name }}-allow-same-namespace
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: {{ .Values.namespace | default .Release.Namespace }}`;
    }

    /**
     * Generate shared service monitor
     * @param {Array} applications - List of applications
     * @returns {string} Service monitor template
     */
    generateSharedServiceMonitor(applications) {
        return `apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: {{ .Release.Name }}-apps
  labels:
    {{- include "chart.labels" . | nindent 4 }}
spec:
  selector:
    matchLabels:
      app.kubernetes.io/instance: {{ .Release.Name }}
  endpoints:
  - port: metrics
    path: /metrics
    interval: 30s`;
    }

    /**
     * Generate shared ingress
     * @param {Array} applications - List of applications
     * @param {Object} options - Options
     * @returns {string} Shared ingress template
     */
    generateSharedIngress(applications, options) {
        return `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{ .Release.Name }}-shared
  labels:
    {{- include "chart.labels" . | nindent 4 }}
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /$1
spec:
  ingressClassName: nginx
  rules:
  - host: {{ .Values.global.host | default "localhost" }}
    http:
      paths:
      {{- range $app := .Values.applications }}
      {{- if $app.ingress.enabled }}
      - path: /{{ $app.name }}/?(.*)
        pathType: Prefix
        backend:
          service:
            name: {{ $app.name }}
            port:
              number: {{ $app.service.port }}
      {{- end }}
      {{- end }}`;
    }
}

module.exports = MultiApplicationSupport;

// CLI usage for multi-application support
if (require.main === module) {
    const configFile = process.argv[2];
    
    if (!configFile) {
        console.error('Usage: node multi-application-support.js <config-file>');
        console.error('Example config file:');
        console.error(JSON.stringify({
            applications: [
                { type: 'web-app', name: 'frontend', values: { ingress: { enabled: true } } },
                { type: 'api-service', name: 'backend', values: { database: { enabled: true } } },
                { type: 'database', name: 'postgres', values: { persistence: { size: '10Gi' } } }
            ],
            options: {
                chartName: 'my-app-stack',
                version: '1.0.0'
            }
        }, null, 2));
        process.exit(1);
    }
    
    async function main() {
        try {
            const multiAppSupport = new MultiApplicationSupport();
            const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
            
            console.log('🚀 Starting multi-application template generation...');
            
            // Generate individual application templates
            for (const appConfig of config.applications) {
                console.log(`\n📋 Generating ${appConfig.type} templates...`);
                const templates = multiAppSupport.generateApplicationTemplates(appConfig.type, appConfig.values || {});
                
                // Save templates to directory
                const outputDir = path.join(process.cwd(), 'generated-templates', appConfig.name || appConfig.type);
                fs.mkdirSync(outputDir, { recursive: true });
                
                for (const [filename, content] of Object.entries(templates.templates)) {
                    fs.writeFileSync(path.join(outputDir, filename), content);
                }
                
                // Save values.yaml
                fs.writeFileSync(path.join(outputDir, 'values.yaml'), yaml.stringify(templates.values));
                
                console.log(`✅ Generated ${Object.keys(templates.templates).length} templates for ${appConfig.type}`);
            }
            
            // Generate multi-application chart if requested
            if (config.options && config.options.multiChart) {
                console.log('\n🏗️ Generating multi-application chart...');
                const multiChart = multiAppSupport.generateMultiApplicationChart(config.applications, config.options);
                
                const chartDir = path.join(process.cwd(), 'generated-chart');
                fs.mkdirSync(chartDir, { recursive: true });
                fs.mkdirSync(path.join(chartDir, 'templates'), { recursive: true });
                
                // Save Chart.yaml
                const chartYaml = {
                    apiVersion: 'v2',
                    name: multiChart.metadata.name,
                    version: multiChart.metadata.version,
                    appVersion: multiChart.metadata.appVersion,
                    description: multiChart.metadata.description,
                    type: 'application'
                };
                fs.writeFileSync(path.join(chartDir, 'Chart.yaml'), yaml.stringify(chartYaml));
                
                // Save templates
                for (const [filename, content] of Object.entries(multiChart.templates)) {
                    fs.writeFileSync(path.join(chartDir, 'templates', filename), content);
                }
                
                // Save values.yaml
                fs.writeFileSync(path.join(chartDir, 'values.yaml'), yaml.stringify(multiChart.values));
                
                console.log(`✅ Generated multi-application chart with ${Object.keys(multiChart.templates).length} templates`);
            }
            
        } catch (error) {
            console.error('❌ Multi-application template generation failed:', error.message);
            process.exit(1);
        }
    }
    
    main();
}