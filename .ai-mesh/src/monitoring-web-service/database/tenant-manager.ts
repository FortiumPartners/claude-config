/**
 * =====================================================
 * Tenant Manager - Multi-tenant Database Management
 * External Metrics Web Service
 * =====================================================
 * 
 * This class provides complete tenant lifecycle management
 * for the multi-tenant SaaS platform. It handles:
 * 
 * - Tenant registration and schema creation
 * - Tenant deactivation and cleanup
 * - Tenant lookup and validation
 * - Schema isolation and security
 * 
 * Features:
 * - Automatic schema name generation and validation
 * - Transactional tenant creation with rollback support
 * - Connection pooling and performance optimization
 * - Comprehensive error handling and logging
 * - Type-safe operations with full TypeScript support
 * =====================================================
 */

import { Pool, PoolClient } from 'pg';
import { SchemaCreator } from './schema-creator';
import { Logger } from '../utils/logger';

/**
 * Tenant data structure matching the database schema
 */
export interface Tenant {
  id: string;
  name: string;
  domain: string;
  schemaName: string;
  subscriptionPlan: 'basic' | 'professional' | 'enterprise' | 'custom';
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  metadata: Record<string, any>;
  adminEmail?: string;
  billingEmail?: string;
  dataRegion: string;
  complianceSettings: Record<string, any>;
}

/**
 * Input data for creating a new tenant
 */
export interface CreateTenantInput {
  name: string;
  domain: string;
  subscriptionPlan?: 'basic' | 'professional' | 'enterprise' | 'custom';
  adminEmail?: string;
  billingEmail?: string;
  dataRegion?: string;
  metadata?: Record<string, any>;
  complianceSettings?: Record<string, any>;
}

/**
 * Options for tenant listing and filtering
 */
export interface ListTenantsOptions {
  limit?: number;
  offset?: number;
  subscriptionPlan?: string;
  isActive?: boolean;
  sortBy?: 'created_at' | 'name' | 'domain';
  sortOrder?: 'ASC' | 'DESC';
}

/**
 * Result structure for paginated tenant listings
 */
export interface ListTenantsResult {
  tenants: Tenant[];
  total: number;
  hasMore: boolean;
}

/**
 * Comprehensive tenant management with multi-tenant database operations
 */
export class TenantManager {
  private pool: Pool;
  private schemaCreator: SchemaCreator;
  private logger: Logger;

  constructor(pool: Pool) {
    this.pool = pool;
    this.schemaCreator = new SchemaCreator(pool);
    this.logger = new Logger('TenantManager');
  }

  /**
   * Create a new tenant with isolated schema
   * 
   * This operation is fully transactional - if any step fails,
   * all changes are rolled back to maintain data integrity.
   * 
   * @param tenantData - Tenant information
   * @returns Created tenant with generated ID and schema name
   * @throws Error if tenant creation fails at any step
   */
  async createTenant(tenantData: CreateTenantInput): Promise<Tenant> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      this.logger.info(`Creating tenant: ${tenantData.domain}`);

      // Generate and validate schema name
      const schemaName = this.generateSchemaName(tenantData.domain);
      this.validateSchemaName(schemaName);

      // Check for domain uniqueness
      await this.ensureDomainUnique(client, tenantData.domain);

      // Insert tenant record
      const insertQuery = `
        INSERT INTO tenants (
          name, domain, schema_name, subscription_plan, admin_email, 
          billing_email, data_region, metadata, compliance_settings
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;

      const values = [
        tenantData.name,
        tenantData.domain,
        schemaName,
        tenantData.subscriptionPlan || 'basic',
        tenantData.adminEmail,
        tenantData.billingEmail,
        tenantData.dataRegion || 'us-east-1',
        JSON.stringify(tenantData.metadata || {}),
        JSON.stringify(tenantData.complianceSettings || {})
      ];

      const result = await client.query(insertQuery, values);
      const tenant = this.mapRowToTenant(result.rows[0]);

      // Create tenant schema with all tables and indexes
      await this.schemaCreator.createTenantSchema(schemaName, client);

      await client.query('COMMIT');
      
      this.logger.info(`Tenant created successfully: ${tenant.domain} (${tenant.id})`);
      return tenant;

    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(`Failed to create tenant ${tenantData.domain}:`, error);
      throw new Error(`Tenant creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      client.release();
    }
  }

  /**
   * Retrieve tenant by domain identifier
   * 
   * @param domain - Tenant domain identifier
   * @returns Tenant data or null if not found
   */
  async getTenant(domain: string): Promise<Tenant | null> {
    const client = await this.pool.connect();
    
    try {
      const query = 'SELECT * FROM tenants WHERE domain = $1 AND is_active = true';
      const result = await client.query(query, [domain]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToTenant(result.rows[0]);

    } finally {
      client.release();
    }
  }

  /**
   * Retrieve tenant by ID
   * 
   * @param id - Tenant UUID
   * @returns Tenant data or null if not found
   */
  async getTenantById(id: string): Promise<Tenant | null> {
    const client = await this.pool.connect();
    
    try {
      const query = 'SELECT * FROM tenants WHERE id = $1';
      const result = await client.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToTenant(result.rows[0]);

    } finally {
      client.release();
    }
  }

  /**
   * List tenants with pagination and filtering
   * 
   * @param options - Filtering and pagination options
   * @returns Paginated list of tenants with total count
   */
  async listTenants(options: ListTenantsOptions = {}): Promise<ListTenantsResult> {
    const client = await this.pool.connect();
    
    try {
      const {
        limit = 50,
        offset = 0,
        subscriptionPlan,
        isActive = true,
        sortBy = 'created_at',
        sortOrder = 'DESC'
      } = options;

      // Build dynamic WHERE clause
      const conditions = ['1=1'];
      const values: any[] = [];
      
      if (subscriptionPlan) {
        conditions.push(`subscription_plan = $${values.length + 1}`);
        values.push(subscriptionPlan);
      }
      
      if (isActive !== undefined) {
        conditions.push(`is_active = $${values.length + 1}`);
        values.push(isActive);
      }

      const whereClause = conditions.join(' AND ');
      
      // Count query for pagination
      const countQuery = `SELECT COUNT(*) FROM tenants WHERE ${whereClause}`;
      const countResult = await client.query(countQuery, values);
      const total = parseInt(countResult.rows[0].count);

      // Main query with pagination
      const query = `
        SELECT * FROM tenants 
        WHERE ${whereClause}
        ORDER BY ${sortBy} ${sortOrder}
        LIMIT $${values.length + 1} OFFSET $${values.length + 2}
      `;
      
      const result = await client.query(query, [...values, limit, offset]);
      const tenants = result.rows.map(row => this.mapRowToTenant(row));

      return {
        tenants,
        total,
        hasMore: offset + tenants.length < total
      };

    } finally {
      client.release();
    }
  }

  /**
   * Update tenant information
   * 
   * @param domain - Tenant domain identifier  
   * @param updates - Partial tenant data to update
   * @returns Updated tenant data
   */
  async updateTenant(domain: string, updates: Partial<CreateTenantInput>): Promise<Tenant> {
    const client = await this.pool.connect();
    
    try {
      // Build dynamic UPDATE query
      const setClauses: string[] = [];
      const values: any[] = [];
      
      if (updates.name !== undefined) {
        setClauses.push(`name = $${values.length + 1}`);
        values.push(updates.name);
      }
      
      if (updates.subscriptionPlan !== undefined) {
        setClauses.push(`subscription_plan = $${values.length + 1}`);
        values.push(updates.subscriptionPlan);
      }
      
      if (updates.adminEmail !== undefined) {
        setClauses.push(`admin_email = $${values.length + 1}`);
        values.push(updates.adminEmail);
      }
      
      if (updates.billingEmail !== undefined) {
        setClauses.push(`billing_email = $${values.length + 1}`);
        values.push(updates.billingEmail);
      }
      
      if (updates.metadata !== undefined) {
        setClauses.push(`metadata = $${values.length + 1}`);
        values.push(JSON.stringify(updates.metadata));
      }
      
      if (updates.complianceSettings !== undefined) {
        setClauses.push(`compliance_settings = $${values.length + 1}`);
        values.push(JSON.stringify(updates.complianceSettings));
      }

      if (setClauses.length === 0) {
        throw new Error('No update fields provided');
      }

      // Always update the updated_at timestamp
      setClauses.push('updated_at = NOW()');
      
      const query = `
        UPDATE tenants 
        SET ${setClauses.join(', ')}
        WHERE domain = $${values.length + 1} AND is_active = true
        RETURNING *
      `;
      
      values.push(domain);
      
      const result = await client.query(query, values);
      
      if (result.rows.length === 0) {
        throw new Error(`Tenant not found: ${domain}`);
      }

      const tenant = this.mapRowToTenant(result.rows[0]);
      this.logger.info(`Tenant updated: ${domain}`);
      
      return tenant;

    } finally {
      client.release();
    }
  }

  /**
   * Deactivate a tenant (soft delete)
   * 
   * This marks the tenant as inactive but preserves all data
   * for compliance and potential reactivation.
   * 
   * @param domain - Tenant domain identifier
   */
  async deactivateTenant(domain: string): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      const query = `
        UPDATE tenants 
        SET is_active = false, updated_at = NOW()
        WHERE domain = $1
      `;
      
      const result = await client.query(query, [domain]);
      
      if (result.rowCount === 0) {
        throw new Error(`Tenant not found: ${domain}`);
      }

      this.logger.info(`Tenant deactivated: ${domain}`);

    } finally {
      client.release();
    }
  }

  /**
   * Permanently delete a tenant and all associated data
   * 
   * WARNING: This operation is irreversible and will permanently
   * delete all tenant data including the isolated schema.
   * 
   * @param domain - Tenant domain identifier
   * @param confirmDeletion - Must be true to proceed with deletion
   */
  async deleteTenant(domain: string, confirmDeletion: boolean = false): Promise<void> {
    if (!confirmDeletion) {
      throw new Error('Tenant deletion requires explicit confirmation');
    }

    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get tenant information before deletion
      const tenant = await this.getTenant(domain);
      if (!tenant) {
        throw new Error(`Tenant not found: ${domain}`);
      }

      // Drop tenant schema and all data
      await this.schemaCreator.deleteTenantSchema(tenant.schemaName, client);

      // Delete tenant record
      const query = 'DELETE FROM tenants WHERE domain = $1';
      await client.query(query, [domain]);

      await client.query('COMMIT');
      
      this.logger.warn(`Tenant permanently deleted: ${domain} (${tenant.id})`);

    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(`Failed to delete tenant ${domain}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check if a domain is available for registration
   * 
   * @param domain - Domain to check
   * @returns True if domain is available
   */
  async isDomainAvailable(domain: string): Promise<boolean> {
    const client = await this.pool.connect();
    
    try {
      const query = 'SELECT 1 FROM tenants WHERE domain = $1';
      const result = await client.query(query, [domain]);
      return result.rows.length === 0;
    } finally {
      client.release();
    }
  }

  /**
   * Generate PostgreSQL schema name from domain
   * 
   * @param domain - Tenant domain
   * @returns Valid PostgreSQL schema name
   */
  private generateSchemaName(domain: string): string {
    // Convert domain to valid PostgreSQL identifier
    // Replace hyphens with underscores, ensure it starts with a letter
    let schemaName = domain.replace(/-/g, '_').toLowerCase();
    
    // Ensure it starts with a letter
    if (!/^[a-zA-Z]/.test(schemaName)) {
      schemaName = `tenant_${schemaName}`;
    }
    
    // Limit to PostgreSQL identifier length limit
    if (schemaName.length > 63) {
      schemaName = schemaName.substring(0, 63);
    }
    
    return schemaName;
  }

  /**
   * Validate schema name follows PostgreSQL rules
   * 
   * @param schemaName - Schema name to validate
   * @throws Error if schema name is invalid
   */
  private validateSchemaName(schemaName: string): void {
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(schemaName)) {
      throw new Error(`Invalid schema name: ${schemaName}`);
    }
    
    if (schemaName.length > 63) {
      throw new Error(`Schema name too long: ${schemaName}`);
    }
  }

  /**
   * Ensure domain uniqueness before tenant creation
   * 
   * @param client - Database client
   * @param domain - Domain to check
   * @throws Error if domain already exists
   */
  private async ensureDomainUnique(client: PoolClient, domain: string): Promise<void> {
    const query = 'SELECT 1 FROM tenants WHERE domain = $1';
    const result = await client.query(query, [domain]);
    
    if (result.rows.length > 0) {
      throw new Error(`Domain already exists: ${domain}`);
    }
  }

  /**
   * Map database row to Tenant interface
   * 
   * @param row - Database row
   * @returns Mapped tenant object
   */
  private mapRowToTenant(row: any): Tenant {
    return {
      id: row.id,
      name: row.name,
      domain: row.domain,
      schemaName: row.schema_name,
      subscriptionPlan: row.subscription_plan,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      isActive: row.is_active,
      metadata: row.metadata || {},
      adminEmail: row.admin_email,
      billingEmail: row.billing_email,
      dataRegion: row.data_region,
      complianceSettings: row.compliance_settings || {}
    };
  }
}

/**
 * Factory function to create TenantManager instance
 * 
 * @param pool - PostgreSQL connection pool
 * @returns Configured TenantManager instance
 */
export function createTenantManager(pool: Pool): TenantManager {
  return new TenantManager(pool);
}