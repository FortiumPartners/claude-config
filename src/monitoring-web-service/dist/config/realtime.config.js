"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.featureFlags = exports.securityConfig = exports.cacheConfig = exports.performanceConfig = exports.realtimeConfig = void 0;
exports.realtimeConfig = {
    server: {
        cors: {
            origin: process.env.CORS_ORIGINS?.split(',') || [
                'http://localhost:3000',
                'http://localhost:3001',
                'https://metrics.fortium.dev',
                'https://dashboard.fortium.dev'
            ],
            methods: ['GET', 'POST'],
            credentials: true
        },
        maxConnections: parseInt(process.env.MAX_WEBSOCKET_CONNECTIONS || '1000'),
        heartbeatInterval: parseInt(process.env.WEBSOCKET_HEARTBEAT_INTERVAL || '30000'),
        performanceMonitoringInterval: parseInt(process.env.PERF_MONITOR_INTERVAL || '60000')
    },
    auth: {
        jwtSecret: process.env.JWT_SECRET || 'your-jwt-secret',
        jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret',
        sessionTtl: parseInt(process.env.WEBSOCKET_SESSION_TTL || '3600'),
        rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '60000'),
        rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
        connectionTimeout: parseInt(process.env.CONNECTION_TIMEOUT || '30000'),
        maxConnectionsPerUser: parseInt(process.env.MAX_CONNECTIONS_PER_USER || '5'),
        enableConnectionFingerprinting: process.env.ENABLE_CONNECTION_FINGERPRINTING === 'true',
        enableAuditLogging: process.env.ENABLE_AUDIT_LOGGING === 'true'
    },
    connectionPool: {
        maxConnections: parseInt(process.env.MAX_WEBSOCKET_CONNECTIONS || '1000'),
        maxConnectionsPerUser: parseInt(process.env.MAX_CONNECTIONS_PER_USER || '5'),
        maxConnectionsPerOrganization: parseInt(process.env.MAX_CONNECTIONS_PER_ORG || '100'),
        connectionTimeout: parseInt(process.env.CONNECTION_TIMEOUT || '30000'),
        healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '60000'),
        performanceMonitorInterval: parseInt(process.env.PERF_MONITOR_INTERVAL || '30000'),
        memoryThreshold: parseInt(process.env.MEMORY_THRESHOLD_MB || '512'),
        cpuThreshold: parseInt(process.env.CPU_THRESHOLD_PERCENT || '80')
    },
    events: {
        batchSize: parseInt(process.env.EVENT_BATCH_SIZE || '50'),
        batchInterval: parseInt(process.env.EVENT_BATCH_INTERVAL || '1000'),
        maxRetries: parseInt(process.env.EVENT_MAX_RETRIES || '3'),
        deduplicationWindow: parseInt(process.env.EVENT_DEDUP_WINDOW || '5000'),
        historyRetention: parseInt(process.env.EVENT_HISTORY_RETENTION || '86400000'),
        deadLetterRetention: parseInt(process.env.EVENT_DLQ_RETENTION || '604800000'),
        enableAnalytics: process.env.ENABLE_EVENT_ANALYTICS === 'true'
    },
    streaming: {
        bufferSize: parseInt(process.env.METRICS_BUFFER_SIZE || '100'),
        flushInterval: parseInt(process.env.METRICS_FLUSH_INTERVAL || '5000'),
        compressionEnabled: process.env.ENABLE_METRICS_COMPRESSION === 'true',
        maxUpdateFrequency: parseInt(process.env.MAX_METRICS_UPDATE_FREQ || '10'),
        aggregationWindow: parseInt(process.env.METRICS_AGGREGATION_WINDOW || '60000'),
        retentionPeriod: parseInt(process.env.METRICS_RETENTION_PERIOD || '604800000')
    },
    presence: {
        idleTimeout: parseInt(process.env.PRESENCE_IDLE_TIMEOUT || '300000'),
        awayTimeout: parseInt(process.env.PRESENCE_AWAY_TIMEOUT || '900000'),
        offlineTimeout: parseInt(process.env.PRESENCE_OFFLINE_TIMEOUT || '1800000'),
        heartbeatInterval: parseInt(process.env.PRESENCE_HEARTBEAT_INTERVAL || '30000'),
        historyRetention: parseInt(process.env.PRESENCE_HISTORY_RETENTION || '86400000'),
        enableAnalytics: process.env.ENABLE_PRESENCE_ANALYTICS === 'true'
    },
    activity: {
        maxFeedSize: parseInt(process.env.ACTIVITY_FEED_SIZE || '200'),
        recentActivityWindow: parseInt(process.env.RECENT_ACTIVITY_WINDOW || '3600000'),
        relevanceThreshold: parseInt(process.env.ACTIVITY_RELEVANCE_THRESHOLD || '25'),
        insightsPeriod: parseInt(process.env.ACTIVITY_INSIGHTS_PERIOD || '604800000'),
        enableAnalytics: process.env.ENABLE_ACTIVITY_ANALYTICS === 'true',
        enablePersonalization: process.env.ENABLE_ACTIVITY_PERSONALIZATION === 'true'
    }
};
exports.performanceConfig = {
    monitoringInterval: parseInt(process.env.PERF_MONITOR_INTERVAL || '30000'),
    historySize: parseInt(process.env.PERF_HISTORY_SIZE || '100'),
    alertThresholds: {
        maxLatency: parseInt(process.env.ALERT_MAX_LATENCY || '1000'),
        minThroughput: parseInt(process.env.ALERT_MIN_THROUGHPUT || '10'),
        maxMemoryUsage: parseInt(process.env.ALERT_MAX_MEMORY || '80'),
        maxCpuUsage: parseInt(process.env.ALERT_MAX_CPU || '85'),
        maxErrorRate: parseInt(process.env.ALERT_MAX_ERROR_RATE || '5'),
        minAvailability: parseInt(process.env.ALERT_MIN_AVAILABILITY || '99')
    },
    enablePredictiveAnalysis: process.env.ENABLE_PREDICTIVE_ANALYSIS === 'true',
    baselineCalibrationPeriod: parseInt(process.env.BASELINE_CALIBRATION_PERIOD || '20')
};
exports.cacheConfig = {
    redis: {
        keyPrefix: process.env.REDIS_KEY_PREFIX || 'fortium:realtime:',
        defaultTTL: parseInt(process.env.DEFAULT_CACHE_TTL || '3600'),
        maxMemoryPolicy: process.env.REDIS_MAX_MEMORY_POLICY || 'allkeys-lru',
        enableCompression: process.env.ENABLE_REDIS_COMPRESSION === 'true'
    },
    browser: {
        staticDataTTL: parseInt(process.env.BROWSER_CACHE_TTL || '300'),
        dynamicDataTTL: parseInt(process.env.BROWSER_DYNAMIC_TTL || '60'),
        enableServiceWorker: process.env.ENABLE_SERVICE_WORKER === 'true'
    }
};
exports.securityConfig = {
    websocket: {
        enableTokenRefresh: process.env.ENABLE_TOKEN_REFRESH === 'true',
        tokenRefreshInterval: parseInt(process.env.TOKEN_REFRESH_INTERVAL || '900000'),
        maxPayloadSize: parseInt(process.env.MAX_WEBSOCKET_PAYLOAD || '1048576'),
        enableMessageEncryption: process.env.ENABLE_MESSAGE_ENCRYPTION === 'true'
    },
    collaboration: {
        enablePermissionValidation: process.env.ENABLE_COLLAB_PERMISSIONS === 'true',
        maxCollaborators: parseInt(process.env.MAX_COLLABORATORS || '10'),
        sessionTimeout: parseInt(process.env.COLLAB_SESSION_TIMEOUT || '3600000'),
        enableAuditLogging: process.env.ENABLE_COLLAB_AUDIT === 'true'
    }
};
exports.featureFlags = {
    enableWebSocketScaling: process.env.ENABLE_WEBSOCKET_SCALING === 'true',
    enableAdvancedMetrics: process.env.ENABLE_ADVANCED_METRICS === 'true',
    enableCollaborativeFeatures: process.env.ENABLE_COLLABORATIVE_FEATURES === 'true',
    enablePresenceTracking: process.env.ENABLE_PRESENCE_TRACKING === 'true',
    enableActivityFeed: process.env.ENABLE_ACTIVITY_FEED === 'true',
    enablePerformanceMonitoring: process.env.ENABLE_PERFORMANCE_MONITORING === 'true',
    enablePredictiveAnalytics: process.env.ENABLE_PREDICTIVE_ANALYTICS === 'true',
    enableRealTimeNotifications: process.env.ENABLE_REALTIME_NOTIFICATIONS === 'true'
};
exports.default = {
    realtime: exports.realtimeConfig,
    performance: exports.performanceConfig,
    cache: exports.cacheConfig,
    security: exports.securityConfig,
    features: exports.featureFlags
};
//# sourceMappingURL=realtime.config.js.map