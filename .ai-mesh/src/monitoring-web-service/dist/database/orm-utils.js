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
exports.ormUtils = exports.ORMUtils = void 0;
exports.createDateRangeFilter = createDateRangeFilter;
exports.createSearchFilter = createSearchFilter;
exports.isValidUUID = isValidUUID;
exports.sanitizeSortParams = sanitizeSortParams;
const winston = __importStar(require("winston"));
class ORMUtils {
    logger;
    queryMetrics = {
        queryCount: 0,
        totalDuration: 0,
        averageDuration: 0,
        slowQueries: 0,
    };
    constructor(logger) {
        this.logger = logger || winston.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json()),
            transports: [new winston.transports.Console()],
        });
    }
    async withTransaction(client, operation, options = {}) {
        const start = Date.now();
        const tenantContext = client.getCurrentTenantContext();
        try {
            const result = await client.$transaction(async (tx) => {
                if (tenantContext) {
                    await tx.$executeRaw `SELECT set_config('app.current_organization_id', ${tenantContext.tenantId}, true)`;
                }
                return await operation(tx);
            }, {
                maxWait: options.maxWait || 5000,
                timeout: options.timeout || 10000,
                isolationLevel: options.isolationLevel,
            });
            const duration = Date.now() - start;
            this.updateQueryMetrics(duration);
            this.logger.debug('Transaction completed', {
                duration: `${duration}ms`,
                tenant: tenantContext?.domain || 'no-tenant',
            });
            return result;
        }
        catch (error) {
            const duration = Date.now() - start;
            this.updateQueryMetrics(duration);
            this.logger.error('Transaction failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
                duration: `${duration}ms`,
                tenant: tenantContext?.domain || 'no-tenant',
            });
            throw error;
        }
    }
    async batchProcess(items, processor, config = {}) {
        const batchSize = config.batchSize || 100;
        const maxConcurrency = config.maxConcurrency || 5;
        const enableProgress = config.enableProgress || false;
        const batches = [];
        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize));
        }
        this.logger.info('Starting batch processing', {
            totalItems: items.length,
            batchSize,
            totalBatches: batches.length,
            maxConcurrency,
        });
        const results = [];
        let processed = 0;
        for (let i = 0; i < batches.length; i += maxConcurrency) {
            const concurrentBatches = batches.slice(i, i + maxConcurrency);
            const batchPromises = concurrentBatches.map(async (batch, batchIndex) => {
                const start = Date.now();
                try {
                    const batchResults = await processor(batch);
                    const duration = Date.now() - start;
                    processed += batch.length;
                    if (enableProgress) {
                        this.logger.info('Batch processed', {
                            batchIndex: i + batchIndex,
                            batchSize: batch.length,
                            processed,
                            total: items.length,
                            duration: `${duration}ms`,
                            progress: `${Math.round((processed / items.length) * 100)}%`,
                        });
                    }
                    return batchResults;
                }
                catch (error) {
                    const duration = Date.now() - start;
                    this.logger.error('Batch processing failed', {
                        batchIndex: i + batchIndex,
                        batchSize: batch.length,
                        error: error instanceof Error ? error.message : 'Unknown error',
                        duration: `${duration}ms`,
                    });
                    throw error;
                }
            });
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults.flat());
        }
        this.logger.info('Batch processing completed', {
            totalItems: items.length,
            totalResults: results.length,
            totalBatches: batches.length,
        });
        return results;
    }
    async paginate(query, params) {
        const { page, limit, sortBy, sortOrder = 'desc' } = params;
        const offset = (page - 1) * limit;
        const start = Date.now();
        try {
            const queryOptions = {
                skip: offset,
                take: limit,
            };
            if (sortBy) {
                queryOptions.orderBy = {
                    [sortBy]: sortOrder,
                };
            }
            const [data, total] = await Promise.all([
                query.findMany(queryOptions),
                query.count(),
            ]);
            const duration = Date.now() - start;
            this.updateQueryMetrics(duration);
            const totalPages = Math.ceil(total / limit);
            const hasNext = page < totalPages;
            const hasPrev = page > 1;
            this.logger.debug('Pagination query completed', {
                page,
                limit,
                total,
                totalPages,
                duration: `${duration}ms`,
            });
            return {
                data,
                meta: {
                    page,
                    limit,
                    total,
                    totalPages,
                    hasNext,
                    hasPrev,
                },
            };
        }
        catch (error) {
            const duration = Date.now() - start;
            this.updateQueryMetrics(duration);
            this.logger.error('Pagination query failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
                page,
                limit,
                duration: `${duration}ms`,
            });
            throw error;
        }
    }
    async upsert(model, where, create, update) {
        const start = Date.now();
        try {
            const result = await model.upsert({
                where,
                create: {
                    ...create,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
                update: {
                    ...update,
                    updatedAt: new Date(),
                },
            });
            const duration = Date.now() - start;
            this.updateQueryMetrics(duration);
            this.logger.debug('Upsert operation completed', {
                duration: `${duration}ms`,
            });
            return result;
        }
        catch (error) {
            const duration = Date.now() - start;
            this.updateQueryMetrics(duration);
            this.logger.error('Upsert operation failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
                duration: `${duration}ms`,
            });
            throw error;
        }
    }
    async bulkInsert(model, data, options = {}) {
        const start = Date.now();
        try {
            const now = new Date();
            const enrichedData = data.map(item => ({
                ...item,
                createdAt: now,
                updatedAt: now,
            }));
            let result;
            if (options.updateDuplicates) {
                result = await this.batchProcess(enrichedData, async (batch) => {
                    return Promise.all(batch.map(item => model.upsert({
                        where: { id: item.id },
                        create: item,
                        update: { ...item, updatedAt: now },
                    })));
                }, { batchSize: 100 });
                return result.length;
            }
            else {
                result = await model.createMany({
                    data: enrichedData,
                    skipDuplicates: options.skipDuplicates || false,
                });
                return result.count;
            }
        }
        catch (error) {
            const duration = Date.now() - start;
            this.updateQueryMetrics(duration);
            this.logger.error('Bulk insert failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
                itemCount: data.length,
                duration: `${duration}ms`,
            });
            throw error;
        }
    }
    async softDelete(model, where, deletedByUserId) {
        const start = Date.now();
        try {
            const result = await model.update({
                where,
                data: {
                    isActive: false,
                    updatedAt: new Date(),
                    ...(deletedByUserId && { deletedBy: deletedByUserId }),
                },
            });
            const duration = Date.now() - start;
            this.updateQueryMetrics(duration);
            this.logger.debug('Soft delete completed', {
                duration: `${duration}ms`,
            });
            return result;
        }
        catch (error) {
            const duration = Date.now() - start;
            this.updateQueryMetrics(duration);
            this.logger.error('Soft delete failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
                duration: `${duration}ms`,
            });
            throw error;
        }
    }
    updateQueryMetrics(duration) {
        this.queryMetrics.queryCount += 1;
        this.queryMetrics.totalDuration += duration;
        this.queryMetrics.averageDuration = this.queryMetrics.totalDuration / this.queryMetrics.queryCount;
        if (duration > parseInt(process.env.SLOW_QUERY_THRESHOLD_MS || '1000')) {
            this.queryMetrics.slowQueries += 1;
        }
    }
    getQueryMetrics() {
        return { ...this.queryMetrics };
    }
    resetQueryMetrics() {
        this.queryMetrics = {
            queryCount: 0,
            totalDuration: 0,
            averageDuration: 0,
            slowQueries: 0,
        };
    }
    async generateHealthReport(client) {
        const healthCheck = await client.healthCheck();
        const performanceMetrics = await client.getPerformanceMetrics();
        const queryMetrics = this.getQueryMetrics();
        const recommendations = [];
        let status = 'healthy';
        if (queryMetrics.averageDuration > 500) {
            status = 'degraded';
            recommendations.push('Average query time is high - consider query optimization');
        }
        if (queryMetrics.slowQueries / queryMetrics.queryCount > 0.1) {
            status = 'degraded';
            recommendations.push('High percentage of slow queries detected');
        }
        if (performanceMetrics.activeConnections > 8) {
            recommendations.push('High number of active connections - consider connection pooling optimization');
        }
        if (!healthCheck.details.connection) {
            status = 'unhealthy';
            recommendations.push('Database connection failed - check connectivity');
        }
        return {
            status,
            metrics: queryMetrics,
            performance: performanceMetrics,
            recommendations,
        };
    }
}
exports.ORMUtils = ORMUtils;
exports.ormUtils = new ORMUtils();
function createDateRangeFilter(field, startDate, endDate) {
    const filter = {};
    if (startDate || endDate) {
        filter[field] = {};
        if (startDate)
            filter[field].gte = startDate;
        if (endDate)
            filter[field].lte = endDate;
    }
    return filter;
}
function createSearchFilter(fields, searchTerm) {
    if (!searchTerm || searchTerm.trim() === '') {
        return {};
    }
    return {
        OR: fields.map(field => ({
            [field]: {
                contains: searchTerm.trim(),
                mode: 'insensitive',
            },
        })),
    };
}
function isValidUUID(uuid) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
}
function sanitizeSortParams(sortBy, allowedFields) {
    const [field, order] = sortBy.split(':');
    if (!allowedFields.includes(field)) {
        return null;
    }
    return {
        field,
        order: order === 'desc' ? 'desc' : 'asc',
    };
}
//# sourceMappingURL=orm-utils.js.map