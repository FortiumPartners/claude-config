/**
 * Tenant Provisioning Service
 * Fortium External Metrics Web Service - Task 2.5: Tenant Provisioning System
 */

import { getPrismaClient, TenantContext } from '../database/prisma-client';
import { logger } from '../config/logger';
import { AppError, ValidationError } from '../middleware/error.middleware';
import Joi from 'joi';

// Tenant creation interface
export interface CreateTenantRequest {
  name: string;
  domain: string;
  adminEmail: string;
  adminFirstName: string;
  adminLastName: string;
  subscriptionPlan?: string;
  billingEmail?: string;
  dataRegion?: string;
  complianceSettings?: Record<string, any>;
}

// Tenant creation result
export interface TenantCreationResult {
  tenant: {
    id: string;
    name: string;
    domain: string;
    schemaName: string;
    subscriptionPlan: string;
    isActive: boolean;
    createdAt: Date;
  };
  adminUser: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    isActive: boolean;
  };
  accessCredentials?: {
    temporaryPassword?: string;
    invitationToken?: string;
  };
}

// Validation schema
const createTenantSchema = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  domain: Joi.string().domain().required(),
  adminEmail: Joi.string().email().required(),
  adminFirstName: Joi.string().min(1).max(100).required(),
  adminLastName: Joi.string().min(1).max(100).required(),
  subscriptionPlan: Joi.string().valid('basic', 'pro', 'enterprise').default('basic'),
  billingEmail: Joi.string().email().optional(),
  dataRegion: Joi.string().max(50).default('us-east-1'),
  complianceSettings: Joi.object().default({}),
});

export class TenantProvisioningService {
  private prisma = getPrismaClient();

  /**
   * Create a new tenant with database schema and admin user
   */
  async createTenant(request: CreateTenantRequest): Promise<TenantCreationResult> {
    // Validate input
    const { error, value } = createTenantSchema.validate(request);
    if (error) {
      throw new ValidationError(error.details.map(d => d.message).join(', '));
    }

    const {
      name,
      domain,
      adminEmail,
      adminFirstName,
      adminLastName,
      subscriptionPlan,
      billingEmail,
      dataRegion,
      complianceSettings
    } = value;

    try {
      // Check if tenant already exists
      const existingTenant = await this.prisma.tenant.findFirst({
        where: {
          OR: [
            { name: name },
            { domain: domain }
          ]
        }
      });

      if (existingTenant) {
        throw new ValidationError(
          `Tenant with name "${name}" or domain "${domain}" already exists`
        );
      }

      // Generate unique schema name
      const schemaName = this.generateSchemaName(domain);
      
      // Validate schema name doesn't exist
      await this.validateSchemaName(schemaName);

      logger.info('Starting tenant provisioning', {
        name,
        domain,
        schemaName,
        adminEmail
      });

      // Start transaction for tenant creation
      const result = await this.prisma.$transaction(async (tx) => {
        // 1. Create tenant record
        const tenant = await tx.tenant.create({
          data: {
            name,
            domain,
            schemaName,
            subscriptionPlan: subscriptionPlan!,
            adminEmail: adminEmail,
            billingEmail: billingEmail || adminEmail,
            dataRegion: dataRegion!,
            complianceSettings: complianceSettings!,
            isActive: true,
          }
        });

        logger.info('Tenant record created', { tenantId: tenant.id });

        // 2. Create tenant database schema
        await this.createTenantSchema(schemaName);

        // 3. Set tenant context for user creation
        const tenantContext: TenantContext = {
          tenantId: tenant.id,
          schemaName: tenant.schemaName,
          domain: tenant.domain
        };

        // 4. Create admin user in tenant schema
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

        logger.info('Admin user created', {
          tenantId: tenant.id,
          adminUserId: adminUser.id,
          adminEmail: adminUser.email
        });

        // 5. Create default dashboard configuration
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
            // In production, this would be sent via email
            invitationToken: this.generateInvitationToken()
          }
        };
      });

      logger.info('Tenant provisioning completed successfully', {
        tenantId: result.tenant.id,
        domain: result.tenant.domain,
        adminUserId: result.adminUser.id
      });

      return result;
    } catch (error) {
      logger.error('Tenant provisioning failed', {
        name,
        domain,
        adminEmail,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Cleanup on failure (best effort)
      try {
        await this.cleanupFailedProvisioning(domain);
      } catch (cleanupError) {
        logger.error('Cleanup after provisioning failure also failed', { 
          domain, 
          cleanupError 
        });
      }

      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError('Tenant provisioning failed', 500);
    }
  }

  /**
   * Deactivate a tenant (soft delete)
   */
  async deactivateTenant(tenantId: string): Promise<void> {
    try {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId }
      });

      if (!tenant) {
        throw new ValidationError('Tenant not found');
      }

      if (!tenant.isActive) {
        throw new ValidationError('Tenant is already deactivated');
      }

      // Deactivate tenant
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: {
          isActive: false,
          updatedAt: new Date(),
        }
      });

      // Deactivate all users in tenant
      const tenantContext: TenantContext = {
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

      logger.info('Tenant deactivated', {
        tenantId,
        domain: tenant.domain
      });
    } catch (error) {
      logger.error('Tenant deactivation failed', { tenantId, error });
      throw error instanceof AppError ? error : new AppError('Tenant deactivation failed', 500);
    }
  }

  /**
   * Generate unique schema name from domain
   */
  private generateSchemaName(domain: string): string {
    // Convert domain to valid PostgreSQL schema name
    // Remove TLD and special characters, add timestamp for uniqueness
    const baseName = domain
      .split('.')[0]
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .substring(0, 20);
    
    const timestamp = Date.now().toString().slice(-8);
    return `tenant_${baseName}_${timestamp}`;
  }

  /**
   * Validate that schema name doesn't already exist
   */
  private async validateSchemaName(schemaName: string): Promise<void> {
    const existingTenant = await this.prisma.tenant.findFirst({
      where: { schemaName }
    });

    if (existingTenant) {
      throw new ValidationError(`Schema name "${schemaName}" already exists`);
    }
  }

  /**
   * Create database schema for tenant
   */
  private async createTenantSchema(schemaName: string): Promise<void> {
    try {
      // Create the schema
      await this.prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
      
      // Copy table structure from template schema
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

      // Set up row-level security policies
      await this.setupRowLevelSecurity(schemaName);

      logger.info('Tenant schema created successfully', { schemaName });
    } catch (error) {
      logger.error('Failed to create tenant schema', { schemaName, error });
      throw new AppError(`Failed to create tenant schema: ${schemaName}`, 500);
    }
  }

  /**
   * Set up row-level security for tenant schema
   */
  private async setupRowLevelSecurity(schemaName: string): Promise<void> {
    try {
      // Enable RLS on all tenant tables
      const tables = ['users', 'metrics_sessions', 'tool_metrics', 'dashboard_configs'];
      
      for (const table of tables) {
        await this.prisma.$executeRawUnsafe(`
          ALTER TABLE "${schemaName}"."${table}" ENABLE ROW LEVEL SECURITY
        `);
      }

      logger.info('Row-level security configured', { schemaName });
    } catch (error) {
      logger.error('Failed to setup RLS', { schemaName, error });
      // Don't throw here as RLS setup is not critical for basic functionality
    }
  }

  /**
   * Create default dashboard configuration for admin user
   */
  private async createDefaultDashboard(context: TenantContext, userId: string): Promise<void> {
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

      logger.info('Default dashboard created', { 
        tenantId: context.tenantId,
        userId 
      });
    } catch (error) {
      logger.error('Failed to create default dashboard', { 
        tenantId: context.tenantId,
        userId,
        error 
      });
      // Don't throw as this is not critical
    }
  }

  /**
   * Generate invitation token for admin user
   */
  private generateInvitationToken(): string {
    // In production, this would be a proper JWT or secure random token
    return Buffer.from(`invitation_${Date.now()}_${Math.random()}`).toString('base64');
  }

  /**
   * Cleanup resources after failed provisioning
   */
  private async cleanupFailedProvisioning(domain: string): Promise<void> {
    try {
      // Find and remove any partially created tenant
      const tenant = await this.prisma.tenant.findFirst({
        where: { domain }
      });

      if (tenant) {
        // Drop schema if it exists
        try {
          await this.prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${tenant.schemaName}" CASCADE`);
        } catch (schemaError) {
          logger.warn('Failed to drop schema during cleanup', { 
            schemaName: tenant.schemaName,
            schemaError 
          });
        }

        // Remove tenant record
        await this.prisma.tenant.delete({
          where: { id: tenant.id }
        });

        logger.info('Cleanup completed', { 
          tenantId: tenant.id,
          domain,
          schemaName: tenant.schemaName 
        });
      }
    } catch (error) {
      logger.error('Cleanup operation failed', { domain, error });
    }
  }

  /**
   * Get tenant provisioning status
   */
  async getTenantStatus(tenantId: string): Promise<{
    tenant: any;
    userCount: number;
    schemaExists: boolean;
    isHealthy: boolean;
  }> {
    try {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId }
      });

      if (!tenant) {
        throw new ValidationError('Tenant not found');
      }

      const tenantContext: TenantContext = {
        tenantId: tenant.id,
        schemaName: tenant.schemaName,
        domain: tenant.domain
      };

      // Get user count
      const userCount = await this.prisma.withTenantContext(tenantContext, async (client) => {
        return await client.user.count();
      });

      // Check if schema exists
      const schemaExists = await this.checkSchemaExists(tenant.schemaName);

      return {
        tenant,
        userCount,
        schemaExists,
        isHealthy: tenant.isActive && schemaExists && userCount > 0
      };
    } catch (error) {
      logger.error('Failed to get tenant status', { tenantId, error });
      throw error instanceof AppError ? error : new AppError('Failed to get tenant status', 500);
    }
  }

  /**
   * Check if database schema exists
   */
  private async checkSchemaExists(schemaName: string): Promise<boolean> {
    try {
      const result = await this.prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS(
          SELECT 1 FROM information_schema.schemata 
          WHERE schema_name = ${schemaName}
        ) as exists
      `;
      
      return result[0]?.exists || false;
    } catch (error) {
      logger.error('Failed to check schema existence', { schemaName, error });
      return false;
    }
  }
}