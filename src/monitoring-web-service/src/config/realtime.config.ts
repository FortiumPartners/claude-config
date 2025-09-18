/**
 * Real-time Configuration - Sprint 5
 * Configuration settings for all real-time features and WebSocket components
 */

import { RealTimeServiceConfig } from '../services/realtime-service-manager';

export const realtimeConfig: RealTimeServiceConfig = {
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
    heartbeatInterval: parseInt(process.env.WEBSOCKET_HEARTBEAT_INTERVAL || '30000'), // 30 seconds
    performanceMonitoringInterval: parseInt(process.env.PERF_MONITOR_INTERVAL || '60000') // 1 minute
  },

  auth: {
    jwtSecret: process.env.JWT_SECRET || 'your-jwt-secret',
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret',
    sessionTtl: parseInt(process.env.WEBSOCKET_SESSION_TTL || '3600'), // 1 hour
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '60000'), // 1 minute
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    connectionTimeout: parseInt(process.env.CONNECTION_TIMEOUT || '30000'), // 30 seconds
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
    memoryThreshold: parseInt(process.env.MEMORY_THRESHOLD_MB || '512'), // MB
    cpuThreshold: parseInt(process.env.CPU_THRESHOLD_PERCENT || '80') // percentage
  },

  events: {
    batchSize: parseInt(process.env.EVENT_BATCH_SIZE || '50'),
    batchInterval: parseInt(process.env.EVENT_BATCH_INTERVAL || '1000'), // 1 second
    maxRetries: parseInt(process.env.EVENT_MAX_RETRIES || '3'),
    deduplicationWindow: parseInt(process.env.EVENT_DEDUP_WINDOW || '5000'), // 5 seconds
    historyRetention: parseInt(process.env.EVENT_HISTORY_RETENTION || '86400000'), // 24 hours
    deadLetterRetention: parseInt(process.env.EVENT_DLQ_RETENTION || '604800000'), // 7 days
    enableAnalytics: process.env.ENABLE_EVENT_ANALYTICS === 'true'
  },

  streaming: {
    bufferSize: parseInt(process.env.METRICS_BUFFER_SIZE || '100'),
    flushInterval: parseInt(process.env.METRICS_FLUSH_INTERVAL || '5000'), // 5 seconds
    compressionEnabled: process.env.ENABLE_METRICS_COMPRESSION === 'true',
    maxUpdateFrequency: parseInt(process.env.MAX_METRICS_UPDATE_FREQ || '10'), // Hz
    aggregationWindow: parseInt(process.env.METRICS_AGGREGATION_WINDOW || '60000'), // 1 minute
    retentionPeriod: parseInt(process.env.METRICS_RETENTION_PERIOD || '604800000') // 7 days
  },

  presence: {
    idleTimeout: parseInt(process.env.PRESENCE_IDLE_TIMEOUT || '300000'), // 5 minutes
    awayTimeout: parseInt(process.env.PRESENCE_AWAY_TIMEOUT || '900000'), // 15 minutes
    offlineTimeout: parseInt(process.env.PRESENCE_OFFLINE_TIMEOUT || '1800000'), // 30 minutes
    heartbeatInterval: parseInt(process.env.PRESENCE_HEARTBEAT_INTERVAL || '30000'), // 30 seconds
    historyRetention: parseInt(process.env.PRESENCE_HISTORY_RETENTION || '86400000'), // 24 hours
    enableAnalytics: process.env.ENABLE_PRESENCE_ANALYTICS === 'true'
  },

  activity: {
    maxFeedSize: parseInt(process.env.ACTIVITY_FEED_SIZE || '200'),
    recentActivityWindow: parseInt(process.env.RECENT_ACTIVITY_WINDOW || '3600000'), // 1 hour
    relevanceThreshold: parseInt(process.env.ACTIVITY_RELEVANCE_THRESHOLD || '25'),
    insightsPeriod: parseInt(process.env.ACTIVITY_INSIGHTS_PERIOD || '604800000'), // 7 days
    enableAnalytics: process.env.ENABLE_ACTIVITY_ANALYTICS === 'true',
    enablePersonalization: process.env.ENABLE_ACTIVITY_PERSONALIZATION === 'true'
  }
};

// Performance monitoring configuration
export const performanceConfig = {
  monitoringInterval: parseInt(process.env.PERF_MONITOR_INTERVAL || '30000'), // 30 seconds
  historySize: parseInt(process.env.PERF_HISTORY_SIZE || '100'),
  alertThresholds: {
    maxLatency: parseInt(process.env.ALERT_MAX_LATENCY || '1000'), // 1 second
    minThroughput: parseInt(process.env.ALERT_MIN_THROUGHPUT || '10'), // messages/second
    maxMemoryUsage: parseInt(process.env.ALERT_MAX_MEMORY || '80'), // percentage
    maxCpuUsage: parseInt(process.env.ALERT_MAX_CPU || '85'), // percentage
    maxErrorRate: parseInt(process.env.ALERT_MAX_ERROR_RATE || '5'), // percentage
    minAvailability: parseInt(process.env.ALERT_MIN_AVAILABILITY || '99') // percentage
  },
  enablePredictiveAnalysis: process.env.ENABLE_PREDICTIVE_ANALYSIS === 'true',
  baselineCalibrationPeriod: parseInt(process.env.BASELINE_CALIBRATION_PERIOD || '20') // measurements
};

// Caching configuration for real-time features
export const cacheConfig = {
  redis: {
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'fortium:realtime:',
    defaultTTL: parseInt(process.env.DEFAULT_CACHE_TTL || '3600'), // 1 hour
    maxMemoryPolicy: process.env.REDIS_MAX_MEMORY_POLICY || 'allkeys-lru',
    enableCompression: process.env.ENABLE_REDIS_COMPRESSION === 'true'
  },
  browser: {
    staticDataTTL: parseInt(process.env.BROWSER_CACHE_TTL || '300'), // 5 minutes
    dynamicDataTTL: parseInt(process.env.BROWSER_DYNAMIC_TTL || '60'), // 1 minute
    enableServiceWorker: process.env.ENABLE_SERVICE_WORKER === 'true'
  }
};

// Security configuration for real-time features
export const securityConfig = {
  websocket: {
    enableTokenRefresh: process.env.ENABLE_TOKEN_REFRESH === 'true',
    tokenRefreshInterval: parseInt(process.env.TOKEN_REFRESH_INTERVAL || '900000'), // 15 minutes
    maxPayloadSize: parseInt(process.env.MAX_WEBSOCKET_PAYLOAD || '1048576'), // 1MB
    enableMessageEncryption: process.env.ENABLE_MESSAGE_ENCRYPTION === 'true'
  },
  collaboration: {
    enablePermissionValidation: process.env.ENABLE_COLLAB_PERMISSIONS === 'true',
    maxCollaborators: parseInt(process.env.MAX_COLLABORATORS || '10'),
    sessionTimeout: parseInt(process.env.COLLAB_SESSION_TIMEOUT || '3600000'), // 1 hour
    enableAuditLogging: process.env.ENABLE_COLLAB_AUDIT === 'true'
  }
};

// Feature flags for gradual rollout
export const featureFlags = {
  enableWebSocketScaling: process.env.ENABLE_WEBSOCKET_SCALING === 'true',
  enableAdvancedMetrics: process.env.ENABLE_ADVANCED_METRICS === 'true',
  enableCollaborativeFeatures: process.env.ENABLE_COLLABORATIVE_FEATURES === 'true',
  enablePresenceTracking: process.env.ENABLE_PRESENCE_TRACKING === 'true',
  enableActivityFeed: process.env.ENABLE_ACTIVITY_FEED === 'true',
  enablePerformanceMonitoring: process.env.ENABLE_PERFORMANCE_MONITORING === 'true',
  enablePredictiveAnalytics: process.env.ENABLE_PREDICTIVE_ANALYTICS === 'true',
  enableRealTimeNotifications: process.env.ENABLE_REALTIME_NOTIFICATIONS === 'true'
};

// Export default configuration
export default {
  realtime: realtimeConfig,
  performance: performanceConfig,
  cache: cacheConfig,
  security: securityConfig,
  features: featureFlags
};