import { RealTimeServiceConfig } from '../services/realtime-service-manager';
export declare const realtimeConfig: RealTimeServiceConfig;
export declare const performanceConfig: {
    monitoringInterval: number;
    historySize: number;
    alertThresholds: {
        maxLatency: number;
        minThroughput: number;
        maxMemoryUsage: number;
        maxCpuUsage: number;
        maxErrorRate: number;
        minAvailability: number;
    };
    enablePredictiveAnalysis: boolean;
    baselineCalibrationPeriod: number;
};
export declare const cacheConfig: {
    redis: {
        keyPrefix: string;
        defaultTTL: number;
        maxMemoryPolicy: string;
        enableCompression: boolean;
    };
    browser: {
        staticDataTTL: number;
        dynamicDataTTL: number;
        enableServiceWorker: boolean;
    };
};
export declare const securityConfig: {
    websocket: {
        enableTokenRefresh: boolean;
        tokenRefreshInterval: number;
        maxPayloadSize: number;
        enableMessageEncryption: boolean;
    };
    collaboration: {
        enablePermissionValidation: boolean;
        maxCollaborators: number;
        sessionTimeout: number;
        enableAuditLogging: boolean;
    };
};
export declare const featureFlags: {
    enableWebSocketScaling: boolean;
    enableAdvancedMetrics: boolean;
    enableCollaborativeFeatures: boolean;
    enablePresenceTracking: boolean;
    enableActivityFeed: boolean;
    enablePerformanceMonitoring: boolean;
    enablePredictiveAnalytics: boolean;
    enableRealTimeNotifications: boolean;
};
declare const _default: {
    realtime: RealTimeServiceConfig;
    performance: {
        monitoringInterval: number;
        historySize: number;
        alertThresholds: {
            maxLatency: number;
            minThroughput: number;
            maxMemoryUsage: number;
            maxCpuUsage: number;
            maxErrorRate: number;
            minAvailability: number;
        };
        enablePredictiveAnalysis: boolean;
        baselineCalibrationPeriod: number;
    };
    cache: {
        redis: {
            keyPrefix: string;
            defaultTTL: number;
            maxMemoryPolicy: string;
            enableCompression: boolean;
        };
        browser: {
            staticDataTTL: number;
            dynamicDataTTL: number;
            enableServiceWorker: boolean;
        };
    };
    security: {
        websocket: {
            enableTokenRefresh: boolean;
            tokenRefreshInterval: number;
            maxPayloadSize: number;
            enableMessageEncryption: boolean;
        };
        collaboration: {
            enablePermissionValidation: boolean;
            maxCollaborators: number;
            sessionTimeout: number;
            enableAuditLogging: boolean;
        };
    };
    features: {
        enableWebSocketScaling: boolean;
        enableAdvancedMetrics: boolean;
        enableCollaborativeFeatures: boolean;
        enablePresenceTracking: boolean;
        enableActivityFeed: boolean;
        enablePerformanceMonitoring: boolean;
        enablePredictiveAnalytics: boolean;
        enableRealTimeNotifications: boolean;
    };
};
export default _default;
//# sourceMappingURL=realtime.config.d.ts.map