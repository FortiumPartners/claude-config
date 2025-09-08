import { DatabaseConnection } from '../database/connection';
import * as winston from 'winston';
export interface LegacyMcpRequest {
    id?: number | string;
    method: string;
    params?: any;
    version?: string;
}
export interface LegacyMcpResponse {
    id?: number | string;
    result?: any;
    error?: {
        code: number;
        message: string;
        data?: any;
    };
}
export interface CompatibilityRule {
    legacyMethod: string;
    modernMethod: string;
    paramTransformer?: (params: any) => any;
    responseTransformer?: (response: any) => any;
    deprecationWarning?: string;
}
export declare class CompatibilityService {
    private db;
    private logger;
    private mcpServerService;
    private compatibilityRules;
    constructor(db: DatabaseConnection, logger: winston.Logger);
    handleLegacyRequest(request: LegacyMcpRequest, organizationId: string, userId: string): Promise<LegacyMcpResponse>;
    private detectProtocolVersion;
    private transformLegacyRequest;
    private transformLegacyDashboardRequest;
    private transformLegacyMetricsRequest;
    private transformMcp2023Request;
    private transformPreMcpRequest;
    private transformModernResponse;
    private transformLegacyDashboardResponse;
    private transformLegacyMetricsResponse;
    private transformMcp2023Response;
    private transformPreMcpResponse;
    private transformLegacyMetricsParams;
    private initializeCompatibilityRules;
    private logCompatibilityUsage;
    getCompatibilityStats(organizationId: string): Promise<any>;
}
//# sourceMappingURL=compatibility.service.d.ts.map