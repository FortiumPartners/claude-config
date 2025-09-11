"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../auth/auth.middleware");
const validation_1 = require("../utils/validation");
const response_1 = require("../utils/response");
const error_middleware_1 = require("../middleware/error.middleware");
const router = (0, express_1.Router)();
router.use(response_1.responseMiddleware);
router.use(auth_middleware_1.authenticateToken);
router.use(auth_middleware_1.extractTenant);
router.use(auth_middleware_1.enforceTenantIsolation);
const MetricsController = {
    submitMetrics: (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const { metrics, sessionId, userId, projectId, environment } = req.body;
        const tenantId = req.tenant.id;
        const mockResult = {
            id: `metrics_${Date.now()}`,
            sessionId,
            tenantId,
            metricsCount: metrics.length,
            submittedAt: new Date().toISOString(),
        };
        res.created(mockResult, 'Metrics submitted successfully');
    }),
    queryMetrics: (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const tenantId = req.tenant.id;
        const queryParams = req.query;
        const mockMetrics = [
            {
                id: 'metric_1',
                name: 'response_time',
                value: 150,
                unit: 'ms',
                timestamp: new Date().toISOString(),
                sessionId: queryParams.sessionId || 'session_123',
                tags: { environment: 'production' },
            },
            {
                id: 'metric_2',
                name: 'memory_usage',
                value: 75.5,
                unit: 'MB',
                timestamp: new Date().toISOString(),
                sessionId: queryParams.sessionId || 'session_123',
                tags: { environment: 'production' },
            },
        ];
        const paginationMeta = {
            page: queryParams.page || 1,
            limit: queryParams.limit || 20,
            total: 50,
        };
        res.paginated(mockMetrics, paginationMeta, 'Metrics retrieved successfully');
    }),
    aggregateMetrics: (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const tenantId = req.tenant.id;
        const { metricNames, aggregation, groupBy, startDate, endDate, filters } = req.body;
        const mockAggregation = {
            aggregation,
            groupBy,
            dateRange: { startDate, endDate },
            results: metricNames.map((name) => ({
                metricName: name,
                aggregatedValue: Math.random() * 100,
                unit: name.includes('time') ? 'ms' : 'count',
                dataPoints: [
                    { timestamp: startDate, value: Math.random() * 100 },
                    { timestamp: endDate, value: Math.random() * 100 },
                ],
            })),
        };
        res.success(mockAggregation, 'Metrics aggregated successfully');
    }),
    getMetricsSummary: (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const tenantId = req.tenant.id;
        const mockSummary = {
            tenantId,
            totalSessions: 150,
            totalMetrics: 5000,
            uniqueMetricNames: 25,
            dateRange: {
                earliest: '2024-01-01T00:00:00Z',
                latest: new Date().toISOString(),
            },
            topMetrics: [
                { name: 'response_time', count: 1500 },
                { name: 'memory_usage', count: 1200 },
                { name: 'cpu_usage', count: 1000 },
            ],
            environments: ['development', 'staging', 'production'],
        };
        res.success(mockSummary, 'Metrics summary retrieved successfully');
    }),
    deleteMetrics: (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const { sessionId } = req.params;
        const tenantId = req.tenant.id;
        const mockResult = {
            sessionId,
            tenantId,
            deletedCount: 25,
            deletedAt: new Date().toISOString(),
        };
        res.success(mockResult, 'Metrics deleted successfully');
    }),
    exportMetrics: (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const tenantId = req.tenant.id;
        const { format = 'json', ...queryParams } = req.query;
        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=metrics.csv');
            res.send('metric_name,value,unit,timestamp\nresponse_time,150,ms,2024-01-01T00:00:00Z');
        }
        else {
            const mockExportData = {
                format,
                exportedAt: new Date().toISOString(),
                metrics: [
                    {
                        name: 'response_time',
                        value: 150,
                        unit: 'ms',
                        timestamp: new Date().toISOString(),
                    },
                ],
            };
            res.success(mockExportData, 'Metrics exported successfully');
        }
    }),
};
router.post('/', (0, validation_1.validate)(validation_1.metricsSchemas.submitMetrics), MetricsController.submitMetrics);
router.get('/', (0, validation_1.validate)(validation_1.metricsSchemas.queryMetrics, 'query'), MetricsController.queryMetrics);
router.post('/aggregate', (0, validation_1.validate)(validation_1.metricsSchemas.aggregateMetrics), MetricsController.aggregateMetrics);
router.get('/summary', MetricsController.getMetricsSummary);
router.delete('/session/:sessionId', validation_1.customValidations.uuidParam('sessionId'), MetricsController.deleteMetrics);
router.get('/export', (0, validation_1.validate)(validation_1.metricsSchemas.queryMetrics, 'query'), MetricsController.exportMetrics);
exports.default = router;
//# sourceMappingURL=metrics.routes.js.map