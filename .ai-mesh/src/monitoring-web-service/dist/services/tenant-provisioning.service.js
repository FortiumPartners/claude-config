"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantProvisioningService = void 0;
const prisma_client_1 = require("../database/prisma-client");
const logger_1 = require("../config/logger");
const error_middleware_1 = require("../middleware/error.middleware");
const joi_1 = __importDefault(require("joi"));
const createTenantSchema = joi_1.default.object({
    name: joi_1.default.string().min(2).max(255).required(),
    domain: joi_1.default.string().domain().required(),
    adminEmail: joi_1.default.string().email().required(),
    adminFirstName: joi_1.default.string().min(1).max(100).required(),
    adminLastName: joi_1.default.string().min(1).max(100).required(),
    subscriptionPlan: joi_1.default.string().valid('basic', 'pro', 'enterprise').default('basic'),
    billingEmail: joi_1.default.string().email().optional(),
    dataRegion: joi_1.default.string().max(50).default('us-east-1'),
    complianceSettings: joi_1.default.object().optional(),
});
class TenantProvisioningService {
    prisma = (0, prisma_client_1.getPrismaClient)();
    async createTenant(request) {
        const { error, value } = createTenantSchema.validate(request);
        if (error) {
            throw new error_middleware_1.ValidationError(error.details.map(d => d.message).join(', '));
        }
        const { name, domain, adminEmail, adminFirstName, adminLastName, subscriptionPlan, billingEmail, dataRegion, complianceSettings } = value;
        try {
            const existingTenant = await this.prisma.tenant.findFirst({
                where: {
                    OR: [
                        { name: name },
                        { domain: domain }
                    ]
                }
            });
            if (existingTenant) {
                throw new error_middleware_1.ValidationError(`Tenant with name "${name}" or domain "${domain}" already exists`);
            }
            const schemaName = this.generateSchemaName(domain);
            await this.validateSchemaName(schemaName);
            logger_1.logger.info('Starting tenant provisioning', {
                name,
                domain,
                schemaName,
                adminEmail
            });
            const result = await this.prisma.$transaction(async (tx) => {
                const tenant = await tx.tenant.create({
                    data: {
                        name,
                        domain,
                        schemaName,
                        subscriptionPlan: subscriptionPlan,
                        adminEmail: adminEmail,
                        billingEmail: billingEmail || adminEmail,
                        dataRegion: dataRegion,
                        complianceSettings: complianceSettings,
                        isActive: true,
                    }
                });
                logger_1.logger.info('Tenant record created', { tenantId: tenant.id });
                await this.createTenantSchema(schemaName);
                const tenantContext = {
                    tenantId: tenant.id,
                    schemaName: tenant.schemaName,
                    domain: tenant.domain
                };
                const adminUser = await this.prisma.withTenantContext(tenantContext, async (client) => {
                    return await client.user.create({
                        data: {
                            email: adminEmail.toLowerCase(),
                            firstName: adminFirstName,
                            lastName: adminLastName,
                            role: 'tenant_admin',
                            timezone: 'UTC',
                            preferences: {},
                            isActive: true,
                            loginCount: 0,
                        }
                    });
                });
                logger_1.logger.info('Admin user created', {
                    tenantId: tenant.id,
                    adminUserId: adminUser.id,
                    adminEmail: adminUser.email
                });
                await this.createDefaultDashboard(tenantContext, adminUser.id);
                return {
                    tenant: {
                        id: tenant.id,
                        name: tenant.name,
                        domain: tenant.domain,
                        schemaName: tenant.schemaName,
                        subscriptionPlan: tenant.subscriptionPlan,
                        isActive: tenant.isActive,
                        createdAt: tenant.createdAt,
                    },
                    adminUser: {
                        id: adminUser.id,
                        email: adminUser.email,
                        firstName: adminUser.firstName,
                        lastName: adminUser.lastName,
                        role: adminUser.role,
                        isActive: adminUser.isActive,
                    },
                    accessCredentials: {
                        invitationToken: this.generateInvitationToken()
                    }
                };
            });
            logger_1.logger.info('Tenant provisioning completed successfully', {
                tenantId: result.tenant.id,
                domain: result.tenant.domain,
                adminUserId: result.adminUser.id
            });
            return result;
        }
        catch (error) {
            logger_1.logger.error('Tenant provisioning failed', {
                name,
                domain,
                adminEmail,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            try {
                await this.cleanupFailedProvisioning(domain);
            }
            catch (cleanupError) {
                logger_1.logger.error('Cleanup after provisioning failure also failed', {
                    domain,
                    cleanupError
                });
            }
            if (error instanceof error_middleware_1.AppError) {
                throw error;
            }
            throw new error_middleware_1.AppError('Tenant provisioning failed', 500);
        }
    }
    async deactivateTenant(tenantId) {
        try {
            const tenant = await this.prisma.tenant.findUnique({
                where: { id: tenantId }
            });
            if (!tenant) {
                throw new error_middleware_1.ValidationError('Tenant not found');
            }
            if (!tenant.isActive) {
                throw new error_middleware_1.ValidationError('Tenant is already deactivated');
            }
            await this.prisma.tenant.update({
                where: { id: tenantId },
                data: {
                    isActive: false,
                    updatedAt: new Date(),
                }
            });
            const tenantContext = {
                tenantId: tenant.id,
                schemaName: tenant.schemaName,
                domain: tenant.domain
            };
            await this.prisma.withTenantContext(tenantContext, async (client) => {
                await client.user.updateMany({
                    data: {
                        isActive: false,
                        updatedAt: new Date(),
                    }
                });
            });
            logger_1.logger.info('Tenant deactivated', {
                tenantId,
                domain: tenant.domain
            });
        }
        catch (error) {
            logger_1.logger.error('Tenant deactivation failed', { tenantId, error });
            throw error instanceof error_middleware_1.AppError ? error : new error_middleware_1.AppError('Tenant deactivation failed', 500);
        }
    }
    generateSchemaName(domain) {
        const baseName = domain
            .split('.')[0]
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '_')
            .substring(0, 20);
        const timestamp = Date.now().toString().slice(-8);
        return `tenant_${baseName}_${timestamp}`;
    }
    async validateSchemaName(schemaName) {
        const existingTenant = await this.prisma.tenant.findFirst({
            where: { schemaName }
        });
        if (existingTenant) {
            throw new error_middleware_1.ValidationError(`Schema name "${schemaName}" already exists`);
        }
    }
    async createTenantSchema(schemaName) {
        try {
            await this.prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
            const tables = [
                'users',
                'metrics_sessions',
                'tool_metrics',
                'dashboard_configs'
            ];
            for (const table of tables) {
                await this.prisma.$executeRawUnsafe(`
          CREATE TABLE "${schemaName}"."${table}" (
            LIKE "tenant_template"."${table}" INCLUDING ALL
          )
        `);
            }
            await this.setupRowLevelSecurity(schemaName);
            logger_1.logger.info('Tenant schema created successfully', { schemaName });
        }
        catch (error) {
            logger_1.logger.error('Failed to create tenant schema', { schemaName, error });
            throw new error_middleware_1.AppError(`Failed to create tenant schema: ${schemaName}`, 500);
        }
    }
    async setupRowLevelSecurity(schemaName) {
        try {
            const tables = ['users', 'metrics_sessions', 'tool_metrics', 'dashboard_configs'];
            for (const table of tables) {
                await this.prisma.$executeRawUnsafe(`
          ALTER TABLE "${schemaName}"."${table}" ENABLE ROW LEVEL SECURITY
        `);
            }
            logger_1.logger.info('Row-level security configured', { schemaName });
        }
        catch (error) {
            logger_1.logger.error('Failed to setup RLS', { schemaName, error });
        }
    }
    async createDefaultDashboard(context, userId) {
        try {
            await this.prisma.withTenantContext(context, async (client) => {
                await client.dashboardConfig.create({
                    data: {
                        userId: userId,
                        dashboardName: 'Default Dashboard',
                        description: 'Default dashboard for new tenant',
                        widgetLayout: {
                            widgets: [
                                {
                                    id: 'productivity-overview',
                                    type: 'productivity-chart',
                                    position: { x: 0, y: 0, w: 6, h: 4 },
                                    config: { timeRange: '7d' }
                                },
                                {
                                    id: 'tool-usage',
                                    type: 'tool-usage-chart',
                                    position: { x: 6, y: 0, w: 6, h: 4 },
                                    config: { limit: 10 }
                                }
                            ]
                        },
                        isDefault: true,
                        isPublic: false,
                        refreshIntervalSeconds: 30,
                        sharedWithRoles: [],
                        version: 1
                    }
                });
            });
            logger_1.logger.info('Default dashboard created', {
                tenantId: context.tenantId,
                userId
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to create default dashboard', {
                tenantId: context.tenantId,
                userId,
                error
            });
        }
    }
    generateInvitationToken() {
        return Buffer.from(`invitation_${Date.now()}_${Math.random()}`).toString('base64');
    }
    async cleanupFailedProvisioning(domain) {
        try {
            const tenant = await this.prisma.tenant.findFirst({
                where: { domain }
            });
            if (tenant) {
                try {
                    await this.prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${tenant.schemaName}" CASCADE`);
                }
                catch (schemaError) {
                    logger_1.logger.warn('Failed to drop schema during cleanup', {
                        schemaName: tenant.schemaName,
                        schemaError
                    });
                }
                await this.prisma.tenant.delete({
                    where: { id: tenant.id }
                });
                logger_1.logger.info('Cleanup completed', {
                    tenantId: tenant.id,
                    domain,
                    schemaName: tenant.schemaName
                });
            }
        }
        catch (error) {
            logger_1.logger.error('Cleanup operation failed', { domain, error });
        }
    }
    async getTenantStatus(tenantId) {
        try {
            const tenant = await this.prisma.tenant.findUnique({
                where: { id: tenantId }
            });
            if (!tenant) {
                throw new error_middleware_1.ValidationError('Tenant not found');
            }
            const tenantContext = {
                tenantId: tenant.id,
                schemaName: tenant.schemaName,
                domain: tenant.domain
            };
            const userCount = await this.prisma.withTenantContext(tenantContext, async (client) => {
                return await client.user.count();
            });
            const schemaExists = await this.checkSchemaExists(tenant.schemaName);
            return {
                tenant,
                userCount,
                schemaExists,
                isHealthy: tenant.isActive && schemaExists && userCount > 0
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to get tenant status', { tenantId, error });
            throw error instanceof error_middleware_1.AppError ? error : new error_middleware_1.AppError('Failed to get tenant status', 500);
        }
    }
    async checkSchemaExists(schemaName) {
        try {
            const result = await this.prisma.$queryRaw `
        SELECT EXISTS(
          SELECT 1 FROM information_schema.schemata 
          WHERE schema_name = ${schemaName}
        ) as exists
      `;
            return result[0]?.exists || false;
        }
        catch (error) {
            logger_1.logger.error('Failed to check schema existence', { schemaName, error });
            return false;
        }
    }
}
exports.TenantProvisioningService = TenantProvisioningService;
//# sourceMappingURL=tenant-provisioning.service.js.map