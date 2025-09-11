import { Request, Response } from 'express';
import { MetricsSessionService } from '../services/metrics-session.service';
import { ToolMetricsService } from '../services/tool-metrics.service';
import { MetricsCollectionService } from '../services/metrics-collection.service';
import { DataSyncService } from '../services/data-sync.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import * as winston from 'winston';
export interface MetricsControllerDependencies {
    sessionService: MetricsSessionService;
    toolMetricsService: ToolMetricsService;
    collectionService: MetricsCollectionService;
    syncService: DataSyncService;
    logger: winston.Logger;
}
export declare class MetricsController {
    private sessionService;
    private toolMetricsService;
    private collectionService;
    private syncService;
    private logger;
    constructor(dependencies: MetricsControllerDependencies);
    createSession(req: AuthenticatedRequest, res: Response): Promise<void>;
    updateSession(req: AuthenticatedRequest, res: Response): Promise<void>;
    listSessions(req: AuthenticatedRequest, res: Response): Promise<void>;
    getSession(req: AuthenticatedRequest, res: Response): Promise<void>;
    endSession(req: AuthenticatedRequest, res: Response): Promise<void>;
    recordToolUsage(req: AuthenticatedRequest, res: Response): Promise<void>;
    getToolAnalytics(req: AuthenticatedRequest, res: Response): Promise<void>;
    getToolTrends(req: AuthenticatedRequest, res: Response): Promise<void>;
    recordCommandExecution(req: AuthenticatedRequest, res: Response): Promise<void>;
    recordAgentInteraction(req: AuthenticatedRequest, res: Response): Promise<void>;
    recordProductivityMetric(req: AuthenticatedRequest, res: Response): Promise<void>;
    bulkImport(req: AuthenticatedRequest, res: Response): Promise<void>;
    getBatchProgress(req: AuthenticatedRequest, res: Response): Promise<void>;
    getPerformanceSummary(req: AuthenticatedRequest, res: Response): Promise<void>;
    getPerformanceAlerts(req: AuthenticatedRequest, res: Response): Promise<void>;
    queryMetrics(req: AuthenticatedRequest, res: Response): Promise<void>;
    getHealth(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=metrics.controller.d.ts.map