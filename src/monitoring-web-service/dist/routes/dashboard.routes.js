"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../auth/auth.middleware");
const joi = __importStar(require("joi"));
const validation_1 = require("../utils/validation");
const response_1 = require("../utils/response");
const error_middleware_1 = require("../middleware/error.middleware");
const router = (0, express_1.Router)();
router.use(response_1.responseMiddleware);
router.use(auth_middleware_1.authenticateToken);
router.use(auth_middleware_1.extractTenant);
router.use(auth_middleware_1.enforceTenantIsolation);
const DashboardController = {
    createDashboard: (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const { name, description, config, isPublic, tags } = req.body;
        const tenantId = req.tenant.id;
        const userId = req.user.userId;
        const mockDashboard = {
            id: `dashboard_${Date.now()}`,
            name,
            description,
            config,
            isPublic: isPublic || false,
            tags: tags || [],
            tenantId,
            userId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        res.created(mockDashboard, 'Dashboard created successfully');
    }),
    getDashboards: (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const tenantId = req.tenant.id;
        const queryParams = req.query;
        const mockDashboards = [
            {
                id: 'dashboard_1',
                name: 'Performance Dashboard',
                description: 'Monitor application performance metrics',
                isPublic: false,
                tags: ['performance', 'monitoring'],
                userId: req.user.userId,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
            },
            {
                id: 'dashboard_2',
                name: 'System Health',
                description: 'Overall system health indicators',
                isPublic: true,
                tags: ['health', 'system'],
                userId: req.user.userId,
                createdAt: '2024-01-02T00:00:00Z',
                updatedAt: '2024-01-02T00:00:00Z',
            },
        ];
        const paginationMeta = {
            page: queryParams.page || 1,
            limit: queryParams.limit || 20,
            total: 25,
        };
        res.paginated(mockDashboards, paginationMeta, 'Dashboards retrieved successfully');
    }),
    getDashboard: (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const { dashboardId } = req.params;
        const tenantId = req.tenant.id;
        const mockDashboard = {
            id: dashboardId,
            name: 'Performance Dashboard',
            description: 'Monitor application performance metrics',
            config: {
                widgets: [
                    {
                        id: 'widget_1',
                        type: 'chart',
                        title: 'Response Time',
                        config: {
                            metric: 'response_time',
                            chartType: 'line',
                            timeRange: '24h',
                        },
                        position: { x: 0, y: 0, width: 6, height: 4 },
                    },
                    {
                        id: 'widget_2',
                        type: 'metric',
                        title: 'Active Users',
                        config: {
                            metric: 'active_users',
                            displayType: 'number',
                        },
                        position: { x: 6, y: 0, width: 3, height: 2 },
                    },
                ],
                layout: {
                    columns: 12,
                    rowHeight: 100,
                },
            },
            isPublic: false,
            tags: ['performance', 'monitoring'],
            tenantId,
            userId: req.user.userId,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
        };
        res.success(mockDashboard, 'Dashboard retrieved successfully');
    }),
    updateDashboard: (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const { dashboardId } = req.params;
        const tenantId = req.tenant.id;
        const updateData = req.body;
        const mockDashboard = {
            id: dashboardId,
            ...updateData,
            tenantId,
            updatedAt: new Date().toISOString(),
        };
        res.updated(mockDashboard, 'Dashboard updated successfully');
    }),
    deleteDashboard: (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const { dashboardId } = req.params;
        const tenantId = req.tenant.id;
        const mockResult = {
            dashboardId,
            tenantId,
            deletedAt: new Date().toISOString(),
        };
        res.success(mockResult, 'Dashboard deleted successfully');
    }),
    cloneDashboard: (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const { dashboardId } = req.params;
        const { name } = req.body;
        const tenantId = req.tenant.id;
        const userId = req.user.userId;
        const mockClonedDashboard = {
            id: `dashboard_${Date.now()}`,
            name: name || 'Cloned Dashboard',
            description: 'Cloned from dashboard ' + dashboardId,
            isPublic: false,
            tenantId,
            userId,
            originalDashboardId: dashboardId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        res.created(mockClonedDashboard, 'Dashboard cloned successfully');
    }),
    shareDashboard: (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const { dashboardId } = req.params;
        const { isPublic, shareSettings } = req.body;
        const tenantId = req.tenant.id;
        const mockShareResult = {
            dashboardId,
            isPublic: isPublic || false,
            shareLink: isPublic ? `https://metrics.fortium.com/public/dashboard/${dashboardId}` : null,
            shareSettings: shareSettings || {},
            sharedAt: new Date().toISOString(),
        };
        res.success(mockShareResult, 'Dashboard sharing updated successfully');
    }),
    getDashboardAnalytics: (0, error_middleware_1.asyncHandler)(async (req, res) => {
        const { dashboardId } = req.params;
        const tenantId = req.tenant.id;
        const mockAnalytics = {
            dashboardId,
            viewCount: 156,
            uniqueViewers: 23,
            lastViewed: new Date().toISOString(),
            viewsThisWeek: 45,
            viewsThisMonth: 156,
            popularWidgets: [
                { widgetId: 'widget_1', viewCount: 89 },
                { widgetId: 'widget_2', viewCount: 67 },
            ],
            averageViewDuration: 120,
        };
        res.success(mockAnalytics, 'Dashboard analytics retrieved successfully');
    }),
};
router.post('/', (0, validation_1.validate)(validation_1.dashboardSchemas.createDashboard), DashboardController.createDashboard);
router.get('/', (0, validation_1.validate)(validation_1.dashboardSchemas.queryDashboards, 'query'), DashboardController.getDashboards);
router.get('/:dashboardId', validation_1.customValidations.uuidParam('dashboardId'), DashboardController.getDashboard);
router.put('/:dashboardId', validation_1.customValidations.uuidParam('dashboardId'), (0, validation_1.validate)(validation_1.dashboardSchemas.updateDashboard), DashboardController.updateDashboard);
router.delete('/:dashboardId', validation_1.customValidations.uuidParam('dashboardId'), DashboardController.deleteDashboard);
router.post('/:dashboardId/clone', validation_1.customValidations.uuidParam('dashboardId'), (0, validation_1.validate)(joi.object({
    name: joi.string().max(100).optional(),
})), DashboardController.cloneDashboard);
router.put('/:dashboardId/share', validation_1.customValidations.uuidParam('dashboardId'), (0, validation_1.validate)(joi.object({
    isPublic: joi.boolean().optional(),
    shareSettings: joi.object().optional(),
})), DashboardController.shareDashboard);
router.get('/:dashboardId/analytics', validation_1.customValidations.uuidParam('dashboardId'), (0, auth_middleware_1.requireRole)(['admin', 'user']), DashboardController.getDashboardAnalytics);
exports.default = router;
//# sourceMappingURL=dashboard.routes.js.map