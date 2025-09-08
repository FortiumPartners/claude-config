"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisManager = void 0;
exports.getDefaultRedisConfig = getDefaultRedisConfig;
const ioredis_1 = __importDefault(require("ioredis"));
class RedisManager {
    redis;
    pubRedis;
    subRedis;
    logger;
    config;
    keyPrefixes = {
        METRICS_CACHE: 'metrics:cache:',
        AGGREGATION_CACHE: 'aggregation:cache:',
        REAL_TIME_DATA: 'realtime:data:',
        RATE_LIMIT: 'rate_limit:',
        SESSION: 'session:',
        ALERT_STATE: 'alert:state:',
        PROCESSING_LOCK: 'processing:lock:'
    };
    ttl = {
        METRICS_CACHE: 3600,
        AGGREGATION_CACHE: 7200,
        REAL_TIME_DATA: 300,
        RATE_LIMIT: 60,
        SESSION: 86400,
        ALERT_STATE: 1800,
        PROCESSING_LOCK: 300
    };
    constructor(config, logger) {
        this.config = config;
        this.logger = logger;
        const redisOptions = this.buildRedisOptions(config);
        this.redis = new ioredis_1.default(redisOptions);
        this.pubRedis = new ioredis_1.default(redisOptions);
        this.subRedis = new ioredis_1.default(redisOptions);
        this.setupEventHandlers();
    }
    buildRedisOptions(config) {
        const options = {
            host: config.host,
            port: config.port,
            password: config.password,
            db: config.db || 0,
            keyPrefix: config.keyPrefix || 'fortium:metrics:',
            connectionTimeout: config.connectionTimeout || 10000,
            commandTimeout: config.commandTimeout || 5000,
            retryDelayOnFailover: config.retryDelayOnFailover || 100,
            enableReadyCheck: config.enableReadyCheck !== false,
            maxRetriesPerRequest: config.maxRetriesPerRequest || 3,
            lazyConnect: config.lazyConnect || true,
            keepAlive: config.keepAlive || 30000,
            family: config.family || 4,
            retryStrategy: (times) => {
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
            reconnectOnError: (err) => {
                const targetErrors = ['READONLY', 'ECONNRESET', 'EPIPE'];
                return targetErrors.some(targetError => err.message.includes(targetError));
            }
        };
        if (config.cluster) {
            return {
                ...options,
                enableOfflineQueue: false,
            };
        }
        return options;
    }
    setupEventHandlers() {
        this.redis.on('connect', () => {
            this.logger.info('Redis main connection established');
        });
        this.redis.on('ready', () => {
            this.logger.info('Redis main connection ready');
        });
        this.redis.on('error', (error) => {
            this.logger.error('Redis main connection error', {
                error: error.message,
                code: error.code
            });
        });
        this.redis.on('close', () => {
            this.logger.warn('Redis main connection closed');
        });
        this.redis.on('reconnecting', () => {
            this.logger.info('Redis main connection reconnecting');
        });
        this.pubRedis.on('connect', () => {
            this.logger.info('Redis pub connection established');
        });
        this.pubRedis.on('error', (error) => {
            this.logger.error('Redis pub connection error', {
                error: error.message
            });
        });
        this.subRedis.on('connect', () => {
            this.logger.info('Redis sub connection established');
        });
        this.subRedis.on('error', (error) => {
            this.logger.error('Redis sub connection error', {
                error: error.message
            });
        });
    }
    getRedis() {
        return this.redis;
    }
    getPublisher() {
        return this.pubRedis;
    }
    getSubscriber() {
        return this.subRedis;
    }
    async cacheMetrics(key, data, ttl = this.ttl.METRICS_CACHE) {
        try {
            const cacheKey = this.keyPrefixes.METRICS_CACHE + key;
            await this.redis.setex(cacheKey, ttl, JSON.stringify(data));
        }
        catch (error) {
            this.logger.error('Failed to cache metrics data', {
                key,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async getCachedMetrics(key) {
        try {
            const cacheKey = this.keyPrefixes.METRICS_CACHE + key;
            const cached = await this.redis.get(cacheKey);
            if (!cached) {
                return null;
            }
            return JSON.parse(cached);
        }
        catch (error) {
            this.logger.error('Failed to get cached metrics data', {
                key,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return null;
        }
    }
    async cacheAggregatedMetrics(key, data, ttl = this.ttl.AGGREGATION_CACHE) {
        try {
            const cacheKey = this.keyPrefixes.AGGREGATION_CACHE + key;
            await this.redis.setex(cacheKey, ttl, JSON.stringify(data));
        }
        catch (error) {
            this.logger.error('Failed to cache aggregated metrics', {
                key,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async getCachedAggregatedMetrics(key) {
        try {
            const cacheKey = this.keyPrefixes.AGGREGATION_CACHE + key;
            const cached = await this.redis.get(cacheKey);
            if (!cached) {
                return null;
            }
            return JSON.parse(cached);
        }
        catch (error) {
            this.logger.error('Failed to get cached aggregated metrics', {
                key,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return null;
        }
    }
    async storeRealTimeData(organizationId, data) {
        try {
            const key = this.keyPrefixes.REAL_TIME_DATA + organizationId;
            await this.redis.setex(key, this.ttl.REAL_TIME_DATA, JSON.stringify(data));
            await this.pubRedis.publish(`realtime:${organizationId}`, JSON.stringify(data));
        }
        catch (error) {
            this.logger.error('Failed to store real-time data', {
                organizationId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async subscribeToRealTimeUpdates(organizationId, callback) {
        try {
            const channel = `realtime:${organizationId}`;
            this.subRedis.subscribe(channel, (err) => {
                if (err) {
                    this.logger.error('Failed to subscribe to real-time updates', {
                        organizationId,
                        error: err.message
                    });
                    return;
                }
                this.logger.info('Subscribed to real-time updates', { organizationId });
            });
            this.subRedis.on('message', (receivedChannel, message) => {
                if (receivedChannel === channel) {
                    try {
                        const data = JSON.parse(message);
                        callback(data);
                    }
                    catch (error) {
                        this.logger.error('Failed to parse real-time update message', {
                            organizationId,
                            error: error instanceof Error ? error.message : 'Unknown error'
                        });
                    }
                }
            });
        }
        catch (error) {
            this.logger.error('Failed to setup real-time subscription', {
                organizationId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async acquireProcessingLock(key, ttl = this.ttl.PROCESSING_LOCK) {
        try {
            const lockKey = this.keyPrefixes.PROCESSING_LOCK + key;
            const result = await this.redis.set(lockKey, Date.now().toString(), 'EX', ttl, 'NX');
            return result === 'OK';
        }
        catch (error) {
            this.logger.error('Failed to acquire processing lock', {
                key,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return false;
        }
    }
    async releaseProcessingLock(key) {
        try {
            const lockKey = this.keyPrefixes.PROCESSING_LOCK + key;
            await this.redis.del(lockKey);
        }
        catch (error) {
            this.logger.error('Failed to release processing lock', {
                key,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async setRateLimit(identifier, count, windowMs) {
        try {
            const key = this.keyPrefixes.RATE_LIMIT + identifier;
            await this.redis.setex(key, Math.ceil(windowMs / 1000), count.toString());
        }
        catch (error) {
            this.logger.error('Failed to set rate limit', {
                identifier,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async getRateLimit(identifier) {
        try {
            const key = this.keyPrefixes.RATE_LIMIT + identifier;
            const result = await this.redis.get(key);
            return result ? parseInt(result, 10) : null;
        }
        catch (error) {
            this.logger.error('Failed to get rate limit', {
                identifier,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return null;
        }
    }
    async healthCheck() {
        try {
            const pingResult = await this.redis.ping();
            if (pingResult !== 'PONG') {
                return {
                    status: 'unhealthy',
                    details: { error: 'Redis ping failed', result: pingResult }
                };
            }
            const info = await this.redis.info('memory');
            const memoryInfo = this.parseRedisInfo(info);
            return {
                status: 'healthy',
                details: {
                    ping: pingResult,
                    host: this.config.host,
                    port: this.config.port,
                    db: this.config.db || 0,
                    memory: memoryInfo
                }
            };
        }
        catch (error) {
            return {
                status: 'unhealthy',
                details: {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    host: this.config.host,
                    port: this.config.port
                }
            };
        }
    }
    parseRedisInfo(info) {
        const result = {};
        info.split('\r\n').forEach(line => {
            if (line && !line.startsWith('#')) {
                const [key, value] = line.split(':');
                if (key && value) {
                    result[key] = value;
                }
            }
        });
        return result;
    }
    async close() {
        await Promise.all([
            this.redis.disconnect(),
            this.pubRedis.disconnect(),
            this.subRedis.disconnect()
        ]);
        this.logger.info('All Redis connections closed');
    }
}
exports.RedisManager = RedisManager;
function getDefaultRedisConfig() {
    return {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0', 10),
        keyPrefix: process.env.REDIS_KEY_PREFIX || 'fortium:metrics:',
        connectionTimeout: 10000,
        commandTimeout: 5000,
        retryDelayOnFailover: 100,
        enableReadyCheck: true,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        keepAlive: 30000,
        family: 4
    };
}
//# sourceMappingURL=redis.config.js.map