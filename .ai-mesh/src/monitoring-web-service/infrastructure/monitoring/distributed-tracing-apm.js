/**
 * Task 6.3: Distributed Tracing and Application Performance Monitoring (APM)
 * Helm Chart Specialist - Sprint 6 Observability Implementation
 *
 * Comprehensive tracing system with Jaeger integration, performance profiling,
 * service dependency mapping, and business transaction tracking
 */

const opentelemetry = require('@opentelemetry/api');
const { NodeSDK } = require('@opentelemetry/auto-instrumentations-node');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');
const { PrometheusExporter } = require('@opentelemetry/exporter-prometheus');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');
const winston = require('winston');
const express = require('express');

class HelmChartTracingAPM {
    constructor(options = {}) {
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.Console(),
                new winston.transports.File({ filename: '/var/log/tracing-apm.log' })
            ]
        });

        this.config = {
            serviceName: options.serviceName || 'helm-chart-specialist',
            serviceVersion: options.serviceVersion || '1.0.0',
            environment: options.environment || 'production',
            jaegerEndpoint: options.jaegerEndpoint || 'http://jaeger-collector:14268/api/traces',
            samplingRate: options.samplingRate || 1.0, // 100% sampling for now
            enableProfiling: options.enableProfiling !== false,
            enableBusinessTransactions: options.enableBusinessTransactions !== false,
            ...options
        };

        // Performance tracking
        this.performanceMetrics = new Map();
        this.serviceMap = new Map();
        this.businessTransactions = new Map();
        this.dependencyGraph = new Map();

        this.initializeTracing();
        this.initializeAPM();
        this.initializeBusinessTransactionTracking();

        this.logger.info('Helm Chart Tracing and APM initialized', {
            serviceName: this.config.serviceName,
            environment: this.config.environment,
            jaegerEndpoint: this.config.jaegerEndpoint
        });
    }

    /**
     * Initialize OpenTelemetry tracing with Jaeger
     */
    initializeTracing() {
        // Create resource with service information
        const resource = new Resource({
            [SemanticResourceAttributes.SERVICE_NAME]: this.config.serviceName,
            [SemanticResourceAttributes.SERVICE_VERSION]: this.config.serviceVersion,
            [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: this.config.environment,
            [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'helm-chart-specialist',
            'helm.component': 'tracing-apm',
            'helm.instance_id': process.env.HOSTNAME || 'unknown'
        });

        // Configure Jaeger exporter
        const jaegerExporter = new JaegerExporter({
            endpoint: this.config.jaegerEndpoint,
            headers: {
                'User-Agent': 'helm-chart-specialist-tracer/1.0.0'
            }
        });

        // Configure Prometheus exporter for metrics
        const prometheusExporter = new PrometheusExporter({
            port: 9464, // Different port from main metrics
            endpoint: '/tracing-metrics'
        });

        // Initialize SDK with auto-instrumentations
        this.sdk = new NodeSDK({
            resource: resource,
            traceExporter: jaegerExporter,
            metricReader: new PeriodicExportingMetricReader({
                exporter: prometheusExporter,
                exportIntervalMillis: 10000 // 10 seconds
            }),
            instrumentations: [
                getNodeAutoInstrumentations({
                    // Disable some instrumentations we don't need
                    '@opentelemetry/instrumentation-fs': {
                        enabled: false
                    },
                    '@opentelemetry/instrumentation-dns': {
                        enabled: false
                    },
                    // Enable HTTP instrumentation with custom configuration
                    '@opentelemetry/instrumentation-http': {
                        enabled: true,
                        requestHook: (span, request) => {
                            span.setAttributes({
                                'helm.operation_type': this.detectOperationType(request.url),
                                'helm.chart_type': this.extractChartType(request),
                                'helm.environment': this.extractEnvironment(request)
                            });
                        },
                        responseHook: (span, response) => {
                            if (response.statusCode >= 400) {
                                span.setStatus({
                                    code: opentelemetry.SpanStatusCode.ERROR,
                                    message: `HTTP ${response.statusCode}`
                                });
                            }
                        }
                    },
                    // Enable Express instrumentation
                    '@opentelemetry/instrumentation-express': {
                        enabled: true
                    },
                    // Enable database instrumentations
                    '@opentelemetry/instrumentation-pg': {
                        enabled: true
                    },
                    '@opentelemetry/instrumentation-redis': {
                        enabled: true
                    }
                })
            ],
            sampler: this.createSampler()
        });

        // Start the SDK
        this.sdk.start();

        // Get tracer instance
        this.tracer = opentelemetry.trace.getTracer(
            'helm-chart-specialist-tracer',
            this.config.serviceVersion
        );

        // Get meter instance for custom metrics
        this.meter = opentelemetry.metrics.getMeter(
            'helm-chart-specialist-metrics',
            this.config.serviceVersion
        );
    }

    /**
     * Initialize Application Performance Monitoring
     */
    initializeAPM() {
        // Create custom metrics for APM
        this.chartGenerationLatency = this.meter.createHistogram(
            'helm_chart_generation_latency',
            {
                description: 'Latency of chart generation operations',
                unit: 'ms'
            }
        );

        this.deploymentLatency = this.meter.createHistogram(
            'helm_deployment_latency',
            {
                description: 'Latency of deployment operations',
                unit: 'ms'
            }
        );

        this.validationLatency = this.meter.createHistogram(
            'helm_validation_latency',
            {
                description: 'Latency of validation operations',
                unit: 'ms'
            }
        );

        this.dependencyLatency = this.meter.createHistogram(
            'helm_dependency_latency',
            {
                description: 'Latency of external dependency calls',
                unit: 'ms'
            }
        );

        // Performance profiling metrics
        this.cpuUsage = this.meter.createGauge(
            'helm_cpu_usage_percent',
            {
                description: 'CPU usage percentage during operations'
            }
        );

        this.memoryUsage = this.meter.createGauge(
            'helm_memory_usage_bytes',
            {
                description: 'Memory usage during operations'
            }
        );

        this.gcDuration = this.meter.createHistogram(
            'helm_gc_duration',
            {
                description: 'Garbage collection duration',
                unit: 'ms'
            }
        );

        // Start performance monitoring
        if (this.config.enableProfiling) {
            this.startPerformanceProfiling();
        }
    }

    /**
     * Initialize business transaction tracking
     */
    initializeBusinessTransactionTracking() {
        if (!this.config.enableBusinessTransactions) return;

        // Define business transaction types
        this.businessTransactionTypes = {
            CHART_CREATION: {
                name: 'Chart Creation',
                slaTarget: 30000, // 30 seconds
                criticalPath: ['template-generation', 'validation', 'packaging']
            },
            CHART_DEPLOYMENT: {
                name: 'Chart Deployment',
                slaTarget: 300000, // 5 minutes
                criticalPath: ['pre-validation', 'helm-install', 'health-check']
            },
            SECURITY_SCAN: {
                name: 'Security Scan',
                slaTarget: 180000, // 3 minutes
                criticalPath: ['vulnerability-scan', 'policy-check', 'report-generation']
            },
            CHART_OPTIMIZATION: {
                name: 'Chart Optimization',
                slaTarget: 60000, // 1 minute
                criticalPath: ['analysis', 'optimization', 'validation']
            },
            ENVIRONMENT_PROMOTION: {
                name: 'Environment Promotion',
                slaTarget: 600000, // 10 minutes
                criticalPath: ['validation', 'promotion', 'verification']
            }
        };

        // Business transaction SLA tracking
        this.businessTransactionSLA = this.meter.createHistogram(
            'helm_business_transaction_sla',
            {
                description: 'Business transaction SLA compliance',
                unit: 'ms'
            }
        );

        this.businessTransactionSuccess = this.meter.createCounter(
            'helm_business_transaction_success_total',
            {
                description: 'Total successful business transactions'
            }
        );
    }

    /**
     * Create intelligent sampler for trace collection
     */
    createSampler() {
        return {
            shouldSample: (context, traceId, spanName, spanKind, attributes, links) => {
                // Always sample errors
                if (attributes['http.status_code'] >= 400) {
                    return { decision: opentelemetry.SamplingDecision.RECORD_AND_SAMPLE };
                }

                // Always sample business transactions
                if (spanName.includes('business-transaction')) {
                    return { decision: opentelemetry.SamplingDecision.RECORD_AND_SAMPLE };
                }

                // Always sample security operations
                if (spanName.includes('security') || spanName.includes('vulnerability')) {
                    return { decision: opentelemetry.SamplingDecision.RECORD_AND_SAMPLE };
                }

                // Sample critical operations at 100%
                if (spanName.includes('critical') || spanName.includes('deployment')) {
                    return { decision: opentelemetry.SamplingDecision.RECORD_AND_SAMPLE };
                }

                // Use configured sampling rate for everything else
                if (Math.random() < this.config.samplingRate) {
                    return { decision: opentelemetry.SamplingDecision.RECORD_AND_SAMPLE };
                }

                return { decision: opentelemetry.SamplingDecision.NOT_RECORD };
            }
        };
    }

    /**
     * Start a business transaction trace
     */
    startBusinessTransaction(transactionType, metadata = {}) {
        const txConfig = this.businessTransactionTypes[transactionType];
        if (!txConfig) {
            this.logger.warn('Unknown business transaction type', { transactionType });
            return null;
        }

        const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const span = this.tracer.startSpan(`business-transaction:${txConfig.name}`, {
            kind: opentelemetry.SpanKind.SERVER,
            attributes: {
                'helm.transaction_type': transactionType,
                'helm.transaction_id': transactionId,
                'helm.sla_target_ms': txConfig.slaTarget,
                'helm.critical_path': txConfig.criticalPath.join(','),
                ...metadata
            }
        });

        // Store transaction context
        this.businessTransactions.set(transactionId, {
            id: transactionId,
            type: transactionType,
            config: txConfig,
            span: span,
            startTime: Date.now(),
            phases: new Map(),
            metadata: metadata
        });

        this.logger.info('Business transaction started', {
            transactionId,
            transactionType,
            slaTarget: txConfig.slaTarget
        });

        return transactionId;
    }

    /**
     * Track a phase within a business transaction
     */
    startTransactionPhase(transactionId, phaseName, metadata = {}) {
        const transaction = this.businessTransactions.get(transactionId);
        if (!transaction) {
            this.logger.warn('Transaction not found for phase', { transactionId, phaseName });
            return null;
        }

        const phaseSpan = this.tracer.startSpan(`transaction-phase:${phaseName}`, {
            parent: transaction.span,
            kind: opentelemetry.SpanKind.INTERNAL,
            attributes: {
                'helm.transaction_id': transactionId,
                'helm.phase_name': phaseName,
                'helm.is_critical_path': transaction.config.criticalPath.includes(phaseName),
                ...metadata
            }
        });

        transaction.phases.set(phaseName, {
            name: phaseName,
            span: phaseSpan,
            startTime: Date.now(),
            metadata: metadata
        });

        return phaseSpan;
    }

    /**
     * Complete a transaction phase
     */
    completeTransactionPhase(transactionId, phaseName, success = true, metadata = {}) {
        const transaction = this.businessTransactions.get(transactionId);
        if (!transaction) return;

        const phase = transaction.phases.get(phaseName);
        if (!phase) return;

        const duration = Date.now() - phase.startTime;

        phase.span.setAttributes({
            'helm.phase_duration_ms': duration,
            'helm.phase_success': success,
            ...metadata
        });

        if (!success) {
            phase.span.setStatus({
                code: opentelemetry.SpanStatusCode.ERROR,
                message: metadata.error || 'Phase failed'
            });
        }

        phase.span.end();

        this.logger.info('Transaction phase completed', {
            transactionId,
            phaseName,
            duration,
            success
        });
    }

    /**
     * Complete a business transaction
     */
    completeBusinessTransaction(transactionId, success = true, metadata = {}) {
        const transaction = this.businessTransactions.get(transactionId);
        if (!transaction) return;

        const totalDuration = Date.now() - transaction.startTime;
        const slaViolation = totalDuration > transaction.config.slaTarget;

        transaction.span.setAttributes({
            'helm.transaction_duration_ms': totalDuration,
            'helm.transaction_success': success,
            'helm.sla_violation': slaViolation,
            'helm.phases_count': transaction.phases.size,
            ...metadata
        });

        if (!success || slaViolation) {
            transaction.span.setStatus({
                code: opentelemetry.SpanStatusCode.ERROR,
                message: !success ? 'Transaction failed' : 'SLA violation'
            });
        }

        transaction.span.end();

        // Record metrics
        this.businessTransactionSLA.record(totalDuration, {
            transaction_type: transaction.type,
            sla_violated: slaViolation.toString(),
            environment: this.config.environment
        });

        if (success) {
            this.businessTransactionSuccess.add(1, {
                transaction_type: transaction.type,
                environment: this.config.environment
            });
        }

        // Clean up
        this.businessTransactions.delete(transactionId);

        this.logger.info('Business transaction completed', {
            transactionId,
            duration: totalDuration,
            success,
            slaViolation,
            slaTarget: transaction.config.slaTarget
        });
    }

    /**
     * Start performance profiling
     */
    startPerformanceProfiling() {
        // Monitor garbage collection
        if (global.gc) {
            const originalGC = global.gc;
            global.gc = () => {
                const start = Date.now();
                originalGC();
                const duration = Date.now() - start;

                this.gcDuration.record(duration, {
                    environment: this.config.environment
                });
            };
        }

        // Monitor CPU and memory usage
        setInterval(() => {
            const memUsage = process.memoryUsage();
            const cpuUsage = process.cpuUsage();

            this.memoryUsage.record(memUsage.heapUsed, {
                type: 'heap_used',
                environment: this.config.environment
            });

            this.memoryUsage.record(memUsage.heapTotal, {
                type: 'heap_total',
                environment: this.config.environment
            });

            this.memoryUsage.record(memUsage.external, {
                type: 'external',
                environment: this.config.environment
            });

            // CPU usage calculation (simplified)
            const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
            this.cpuUsage.record(cpuPercent, {
                environment: this.config.environment
            });

        }, 5000); // Every 5 seconds
    }

    /**
     * Create service dependency map
     */
    updateServiceDependencyMap(serviceName, dependencyName, operation, latency, success) {
        const key = `${serviceName}->${dependencyName}`;

        if (!this.serviceMap.has(key)) {
            this.serviceMap.set(key, {
                service: serviceName,
                dependency: dependencyName,
                operations: new Map(),
                totalCalls: 0,
                totalLatency: 0,
                errorCount: 0,
                lastCall: null
            });
        }

        const mapping = this.serviceMap.get(key);
        mapping.totalCalls++;
        mapping.totalLatency += latency;
        mapping.lastCall = Date.now();

        if (!success) {
            mapping.errorCount++;
        }

        // Track per-operation stats
        if (!mapping.operations.has(operation)) {
            mapping.operations.set(operation, {
                calls: 0,
                totalLatency: 0,
                errors: 0
            });
        }

        const opStats = mapping.operations.get(operation);
        opStats.calls++;
        opStats.totalLatency += latency;
        if (!success) opStats.errors++;

        // Record dependency latency metric
        this.dependencyLatency.record(latency, {
            service: serviceName,
            dependency: dependencyName,
            operation: operation,
            success: success.toString(),
            environment: this.config.environment
        });
    }

    /**
     * Generate service dependency report
     */
    getServiceDependencyReport() {
        const report = {
            timestamp: new Date().toISOString(),
            totalDependencies: this.serviceMap.size,
            dependencies: []
        };

        for (const [key, mapping] of this.serviceMap) {
            const avgLatency = mapping.totalLatency / mapping.totalCalls;
            const errorRate = mapping.errorCount / mapping.totalCalls;

            report.dependencies.push({
                service: mapping.service,
                dependency: mapping.dependency,
                totalCalls: mapping.totalCalls,
                avgLatency: Math.round(avgLatency),
                errorRate: Math.round(errorRate * 100) / 100,
                lastCall: new Date(mapping.lastCall).toISOString(),
                operations: Array.from(mapping.operations.entries()).map(([op, stats]) => ({
                    operation: op,
                    calls: stats.calls,
                    avgLatency: Math.round(stats.totalLatency / stats.calls),
                    errorRate: Math.round((stats.errors / stats.calls) * 100) / 100
                }))
            });
        }

        return report;
    }

    /**
     * APM Dashboard API
     */
    getAPMDashboardAPI() {
        const router = express.Router();

        // Service map endpoint
        router.get('/service-map', (req, res) => {
            res.json(this.getServiceDependencyReport());
        });

        // Active transactions
        router.get('/transactions', (req, res) => {
            const activeTransactions = Array.from(this.businessTransactions.values()).map(tx => ({
                id: tx.id,
                type: tx.type,
                duration: Date.now() - tx.startTime,
                slaTarget: tx.config.slaTarget,
                phases: Array.from(tx.phases.keys()),
                metadata: tx.metadata
            }));

            res.json({
                active: activeTransactions,
                total: activeTransactions.length
            });
        });

        // Performance metrics
        router.get('/performance', (req, res) => {
            const memUsage = process.memoryUsage();
            const cpuUsage = process.cpuUsage();

            res.json({
                memory: {
                    heapUsed: memUsage.heapUsed,
                    heapTotal: memUsage.heapTotal,
                    external: memUsage.external,
                    rss: memUsage.rss
                },
                cpu: {
                    user: cpuUsage.user,
                    system: cpuUsage.system
                },
                uptime: process.uptime(),
                timestamp: new Date().toISOString()
            });
        });

        // Trace search endpoint
        router.get('/traces', async (req, res) => {
            const { service, operation, duration, limit = 100 } = req.query;

            // This would integrate with Jaeger API in a real implementation
            res.json({
                message: 'Trace search - integrate with Jaeger Query API',
                params: { service, operation, duration, limit }
            });
        });

        return router;
    }

    /**
     * Utility methods for trace enrichment
     */
    detectOperationType(url) {
        if (url.includes('/api/charts/generate')) return 'chart-generation';
        if (url.includes('/api/deploy')) return 'deployment';
        if (url.includes('/api/validate')) return 'validation';
        if (url.includes('/api/security')) return 'security-scan';
        return 'unknown';
    }

    extractChartType(request) {
        return request.headers['x-chart-type'] ||
               request.body?.chartType ||
               'unknown';
    }

    extractEnvironment(request) {
        return request.headers['x-environment'] ||
               request.body?.environment ||
               this.config.environment;
    }

    /**
     * Shutdown tracing gracefully
     */
    async shutdown() {
        this.logger.info('Shutting down tracing and APM');

        // Complete any active transactions
        for (const [id, transaction] of this.businessTransactions) {
            this.completeBusinessTransaction(id, false, { reason: 'shutdown' });
        }

        // Shutdown SDK
        await this.sdk.shutdown();
    }
}

// Export for integration
module.exports = {
    HelmChartTracingAPM,

    // Factory function
    createTracingAPM: (options) => new HelmChartTracingAPM(options),

    // Business transaction types
    BusinessTransactionTypes: {
        CHART_CREATION: 'CHART_CREATION',
        CHART_DEPLOYMENT: 'CHART_DEPLOYMENT',
        SECURITY_SCAN: 'SECURITY_SCAN',
        CHART_OPTIMIZATION: 'CHART_OPTIMIZATION',
        ENVIRONMENT_PROMOTION: 'ENVIRONMENT_PROMOTION'
    },

    // OpenTelemetry utilities
    opentelemetry: opentelemetry
};

/**
 * Example Usage:
 *
 * const { createTracingAPM, BusinessTransactionTypes } = require('./distributed-tracing-apm');
 *
 * const apm = createTracingAPM({
 *     serviceName: 'helm-chart-specialist',
 *     jaegerEndpoint: 'http://jaeger-collector:14268/api/traces',
 *     samplingRate: 1.0
 * });
 *
 * // Start a business transaction
 * const txId = apm.startBusinessTransaction(
 *     BusinessTransactionTypes.CHART_CREATION,
 *     { chartType: 'web-application', environment: 'production' }
 * );
 *
 * // Track phases
 * apm.startTransactionPhase(txId, 'template-generation');
 * // ... do work ...
 * apm.completeTransactionPhase(txId, 'template-generation', true);
 *
 * // Complete transaction
 * apm.completeBusinessTransaction(txId, true);
 */