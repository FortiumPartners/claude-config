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
exports.Prisma = exports.ExtendedPrismaClient = void 0;
exports.createPrismaClient = createPrismaClient;
exports.getPrismaClient = getPrismaClient;
const prisma_client_1 = require("../generated/prisma-client");
const winston = __importStar(require("winston"));
class ExtendedPrismaClient extends prisma_client_1.PrismaClient {
    logger;
    currentTenant = null;
    enableQueryLogging;
    enablePerformanceMonitoring;
    slowQueryThresholdMs;
    constructor(config = {}) {
        const connectionPoolSettings = config.connectionPoolSettings || {
            min: parseInt(process.env.DATABASE_POOL_MIN || '2'),
            max: parseInt(process.env.DATABASE_POOL_MAX || '10'),
            timeoutMs: parseInt(process.env.DATABASE_POOL_TIMEOUT_MS || '5000'),
        };
        super({
            datasources: {
                db: {
                    url: process.env.DATABASE_URL,
                },
            },
            log: config.enableQueryLogging !== false ? [
                { level: 'query', emit: 'event' },
                { level: 'error', emit: 'event' },
                { level: 'info', emit: 'event' },
                { level: 'warn', emit: 'event' },
            ] : [],
        });
        this.logger = config.logger || this.createDefaultLogger();
        this.enableQueryLogging = config.enableQueryLogging !== false;
        this.enablePerformanceMonitoring = config.enablePerformanceMonitoring !== false;
        this.slowQueryThresholdMs = config.slowQueryThresholdMs ||
            parseInt(process.env.SLOW_QUERY_THRESHOLD_MS || '1000');
        this.setupEventHandlers();
    }
    createDefaultLogger() {
        return winston.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json()),
            transports: [new winston.transports.Console()],
        });
    }
    setupEventHandlers() {
        if (this.enableQueryLogging) {
            this.$on('query', (e) => {
                const duration = parseFloat(e.duration);
                const isSlowQuery = duration > this.slowQueryThresholdMs;
                const logData = {
                    query: e.query,
                    params: e.params,
                    duration: `${duration}ms`,
                    timestamp: e.timestamp,
                    tenant: this.currentTenant?.domain || 'no-tenant',
                    slow_query: isSlowQuery,
                };
                if (isSlowQuery) {
                    this.logger.warn('Slow query detected', logData);
                }
                else {
                    this.logger.debug('Database query executed', logData);
                }
            });
            this.$on('error', (e) => {
                this.logger.error('Database error', {
                    error: e.message,
                    tenant: this.currentTenant?.domain || 'no-tenant',
                    timestamp: e.timestamp,
                });
            });
            this.$on('info', (e) => {
                this.logger.info('Database info', {
                    message: e.message,
                    tenant: this.currentTenant?.domain || 'no-tenant',
                    timestamp: e.timestamp,
                });
            });
            this.$on('warn', (e) => {
                this.logger.warn('Database warning', {
                    message: e.message,
                    tenant: this.currentTenant?.domain || 'no-tenant',
                    timestamp: e.timestamp,
                });
            });
        }
    }
    async setTenantContext(context) {
        this.currentTenant = context;
        await this.$executeRaw `SELECT set_config('app.current_organization_id', ${context.tenantId}, true)`;
        this.logger.debug('Tenant context set', {
            tenant_id: context.tenantId,
            schema_name: context.schemaName,
            domain: context.domain,
        });
    }
    async clearTenantContext() {
        if (this.currentTenant) {
            await this.$executeRaw `SELECT set_config('app.current_organization_id', '', true)`;
            this.logger.debug('Tenant context cleared', {
                previous_tenant: this.currentTenant.domain,
            });
            this.currentTenant = null;
        }
    }
    getCurrentTenantContext() {
        return this.currentTenant;
    }
    async withTenantContext(context, operation) {
        const previousContext = this.currentTenant;
        try {
            await this.setTenantContext(context);
            return await operation(this);
        }
        finally {
            if (previousContext) {
                await this.setTenantContext(previousContext);
            }
            else {
                await this.clearTenantContext();
            }
        }
    }
    async getTenantByDomain(domain) {
        const start = Date.now();
        try {
            const tenant = await this.tenant.findUnique({
                where: {
                    domain,
                    isActive: true,
                },
            });
            const duration = Date.now() - start;
            this.logger.debug('Tenant lookup by domain', {
                domain,
                found: !!tenant,
                duration: `${duration}ms`,
            });
            return tenant;
        }
        catch (error) {
            const duration = Date.now() - start;
            this.logger.error('Tenant lookup failed', {
                domain,
                error: error instanceof Error ? error.message : 'Unknown error',
                duration: `${duration}ms`,
            });
            throw error;
        }
    }
    async healthCheck() {
        const start = Date.now();
        try {
            await this.$queryRaw `SELECT 1`;
            const responseTime = Date.now() - start;
            return {
                status: 'healthy',
                details: {
                    connection: true,
                    responseTime,
                    timestamp: new Date().toISOString(),
                },
            };
        }
        catch (error) {
            const responseTime = Date.now() - start;
            this.logger.error('Database health check failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
                responseTime,
            });
            return {
                status: 'unhealthy',
                details: {
                    connection: false,
                    responseTime,
                    timestamp: new Date().toISOString(),
                },
            };
        }
    }
    async getPerformanceMetrics() {
        if (!this.enablePerformanceMonitoring) {
            return {
                activeConnections: 0,
                totalQueries: 0,
                averageQueryTime: 0,
                slowQueries: 0,
            };
        }
        try {
            const stats = await this.$queryRaw `
        SELECT 
          count(*) as active_connections
        FROM pg_stat_activity 
        WHERE state = 'active'
      `;
            return {
                activeConnections: stats[0]?.active_connections || 0,
                totalQueries: 0,
                averageQueryTime: 0,
                slowQueries: 0,
            };
        }
        catch (error) {
            this.logger.error('Failed to get performance metrics', { error });
            return {
                activeConnections: 0,
                totalQueries: 0,
                averageQueryTime: 0,
                slowQueries: 0,
            };
        }
    }
    async shutdown() {
        try {
            await this.clearTenantContext();
            await this.$disconnect();
            this.logger.info('Database connections closed successfully');
        }
        catch (error) {
            this.logger.error('Error during database shutdown', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        }
    }
}
exports.ExtendedPrismaClient = ExtendedPrismaClient;
function createPrismaClient(config) {
    return new ExtendedPrismaClient(config);
}
let defaultClient = null;
function getPrismaClient(config) {
    if (!defaultClient) {
        defaultClient = createPrismaClient(config);
    }
    return defaultClient;
}
var prisma_client_2 = require("../generated/prisma-client");
Object.defineProperty(exports, "Prisma", { enumerable: true, get: function () { return prisma_client_2.Prisma; } });
//# sourceMappingURL=prisma-client.js.map