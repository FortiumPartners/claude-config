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
exports.PostgreSQLConnection = void 0;
exports.createDbConnection = createDbConnection;
const pg_1 = require("pg");
const prisma_client_1 = require("./prisma-client");
const winston = __importStar(require("winston"));
class PostgreSQLConnection {
    _pool;
    _prisma;
    logger;
    currentOrgContext = null;
    constructor(config, logger) {
        this._pool = new pg_1.Pool({
            ...config,
            max: config.max || 20,
            idleTimeoutMillis: config.idleTimeoutMillis || 30000,
            connectionTimeoutMillis: config.connectionTimeoutMillis || 2000,
        });
        this._prisma = (0, prisma_client_1.getPrismaClient)({
            logger,
            enableQueryLogging: true,
            enablePerformanceMonitoring: true,
        });
        this.logger = logger;
        this._pool.on('error', (err) => {
            this.logger.error('Database pool error:', err);
        });
        this._pool.on('connect', () => {
            this.logger.debug('Database connection established');
        });
        this._pool.on('remove', () => {
            this.logger.debug('Database connection removed from pool');
        });
    }
    get pool() {
        return this._pool;
    }
    get prisma() {
        return this._prisma;
    }
    async query(text, params) {
        const start = Date.now();
        try {
            const client = await this._pool.connect();
            try {
                if (this.currentOrgContext) {
                    await client.query('SELECT set_config($1, $2, true)', ['app.current_organization_id', this.currentOrgContext]);
                }
                const result = await client.query(text, params);
                const duration = Date.now() - start;
                this.logger.debug('Database query executed', {
                    duration,
                    rows: result.rowCount,
                    organization_id: this.currentOrgContext
                });
                return result;
            }
            finally {
                client.release();
            }
        }
        catch (error) {
            const duration = Date.now() - start;
            this.logger.error('Database query failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
                duration,
                query: text.substring(0, 100),
                organization_id: this.currentOrgContext
            });
            throw error;
        }
    }
    async getClient() {
        const client = await this._pool.connect();
        if (this.currentOrgContext) {
            await client.query('SELECT set_config($1, $2, true)', ['app.current_organization_id', this.currentOrgContext]);
        }
        return client;
    }
    async setOrganizationContext(organizationId) {
        this.currentOrgContext = organizationId;
        try {
            const tenant = await this._prisma.tenant.findUnique({
                where: { id: organizationId },
                select: { id: true, domain: true, schemaName: true },
            });
            if (tenant) {
                await this._prisma.setTenantContext({
                    tenantId: tenant.id,
                    schemaName: tenant.schemaName,
                    domain: tenant.domain,
                });
            }
        }
        catch (error) {
            this.logger.warn('Failed to set Prisma tenant context', {
                organizationId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
        this.logger.debug('Organization context set', { organization_id: organizationId });
    }
    async clearOrganizationContext() {
        this.currentOrgContext = null;
        await this._prisma.clearTenantContext();
        this.logger.debug('Organization context cleared');
    }
    async end() {
        await this._prisma.shutdown();
        await this._pool.end();
        this.logger.info('Database connections closed');
    }
    async testConnection() {
        try {
            const result = await this.query('SELECT NOW() as server_time, version() as version');
            this.logger.info('Database connection test successful', {
                server_time: result.rows[0]?.server_time,
                version: result.rows[0]?.version?.split(' ')[0]
            });
            return true;
        }
        catch (error) {
            this.logger.error('Database connection test failed', { error });
            return false;
        }
    }
}
exports.PostgreSQLConnection = PostgreSQLConnection;
async function createDbConnection(logger) {
    const defaultLogger = logger || winston.createLogger({
        level: process.env.LOG_LEVEL || 'info',
        format: winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json()),
        transports: [new winston.transports.Console()]
    });
    const config = {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'metrics_production',
        user: process.env.DB_USER || 'metrics_user',
        password: process.env.DB_PASSWORD,
        max: parseInt(process.env.DB_POOL_SIZE || '20'),
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    };
    defaultLogger.info('Creating database connection', {
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        pool_size: config.max,
        ssl: !!config.ssl
    });
    const connection = new PostgreSQLConnection(config, defaultLogger);
    const isConnected = await connection.testConnection();
    if (!isConnected) {
        throw new Error('Failed to establish database connection');
    }
    return connection;
}
//# sourceMappingURL=connection.js.map