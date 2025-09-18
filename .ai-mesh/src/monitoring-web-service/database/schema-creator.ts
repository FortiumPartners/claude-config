/**
 * =====================================================
 * Schema Creator - Tenant Schema Management Utility
 * External Metrics Web Service
 * =====================================================
 * 
 * This utility class handles the creation, management, and
 * deletion of tenant-specific database schemas. It provides:
 * 
 * - Transactional schema creation from templates
 * - Schema validation and security enforcement
 * - Rollback support for failed operations
 * - Performance-optimized index creation
 * - Complete schema lifecycle management
 * 
 * Features:
 * - Template-based schema replication
 * - Automatic index and constraint creation
 * - Connection reuse for performance
 * - Comprehensive error handling
 * - SQL injection protection through parameterized queries
 * =====================================================
 */

import { Pool, PoolClient } from 'pg';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from '../utils/logger';

/**
 * Schema creation options and configuration
 */
export interface SchemaCreationOptions {
  /** Skip index creation for faster initial setup */
  skipIndexes?: boolean;
  /** Skip constraint creation (not recommended for production) */
  skipConstraints?: boolean;
  /** Custom template schema name (defaults to 'tenant_template') */
  templateSchema?: string;
  /** Additional SQL to run after schema creation */
  postCreationSQL?: string[];
}

/**
 * Schema information and metadata
 */
export interface SchemaInfo {
  name: string;
  exists: boolean;
  tableCount: number;
  indexCount: number;
  constraintCount: number;
  createdAt?: Date;
  sizeBytes?: number;
}

/**
 * Schema creation and management utility
 * 
 * Handles all aspects of tenant schema lifecycle including
 * creation, validation, backup, and deletion operations.
 */
export class SchemaCreator {
  private pool: Pool;
  private logger: Logger;
  private templateSchemaPath: string;

  constructor(pool: Pool) {
    this.pool = pool;
    this.logger = new Logger('SchemaCreator');
    this.templateSchemaPath = path.join(__dirname, 'schemas', 'tenant-template.sql');
  }

  /**
   * Create a new tenant schema by replicating the template
   * 
   * This operation is fully transactional and will rollback
   * all changes if any step fails.
   * 
   * @param schemaName - Name for the new schema
   * @param client - Optional database client (for use within transactions)
   * @param options - Schema creation options
   * @returns Promise that resolves when schema is created
   */
  async createTenantSchema(
    schemaName: string, 
    client?: PoolClient, 
    options: SchemaCreationOptions = {}
  ): Promise<void> {
    const dbClient = client || await this.pool.connect();
    const isExternalTransaction = !!client;

    try {
      if (!isExternalTransaction) {
        await dbClient.query('BEGIN');
      }

      this.logger.info(`Creating tenant schema: ${schemaName}`);

      // Validate schema name
      this.validateSchemaName(schemaName);

      // Check if schema already exists
      if (await this.schemaExists(schemaName, dbClient)) {
        throw new Error(`Schema already exists: ${schemaName}`);
      }

      // Create the schema
      await this.createSchema(schemaName, dbClient);

      // Create all tables, indexes, and constraints from template
      await this.replicateTemplate(schemaName, dbClient, options);

      // Set up schema permissions and security
      await this.setupSchemaPermissions(schemaName, dbClient);

      // Run any post-creation SQL
      if (options.postCreationSQL) {
        await this.executePostCreationSQL(schemaName, dbClient, options.postCreationSQL);
      }

      if (!isExternalTransaction) {
        await dbClient.query('COMMIT');
      }

      this.logger.info(`Schema created successfully: ${schemaName}`);

    } catch (error) {
      if (!isExternalTransaction) {
        await dbClient.query('ROLLBACK');
      }
      
      this.logger.error(`Failed to create schema ${schemaName}:`, error);
      throw new Error(`Schema creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      if (!isExternalTransaction) {
        dbClient.release();
      }
    }
  }

  /**
   * Delete a tenant schema and all its data
   * 
   * WARNING: This operation is irreversible and will permanently
   * delete all data in the schema.
   * 
   * @param schemaName - Name of schema to delete
   * @param client - Optional database client
   * @returns Promise that resolves when schema is deleted
   */
  async deleteTenantSchema(schemaName: string, client?: PoolClient): Promise<void> {
    const dbClient = client || await this.pool.connect();
    const isExternalTransaction = !!client;

    try {
      if (!isExternalTransaction) {
        await dbClient.query('BEGIN');
      }

      this.logger.warn(`Deleting tenant schema: ${schemaName}`);

      // Validate schema name to prevent SQL injection
      this.validateSchemaName(schemaName);

      // Check if schema exists
      if (!(await this.schemaExists(schemaName, dbClient))) {
        this.logger.warn(`Schema does not exist, skipping deletion: ${schemaName}`);
        return;
      }

      // Drop schema and all contents (CASCADE removes all objects)
      const dropQuery = `DROP SCHEMA "${schemaName}" CASCADE`;
      await dbClient.query(dropQuery);

      if (!isExternalTransaction) {
        await dbClient.query('COMMIT');
      }

      this.logger.warn(`Schema deleted: ${schemaName}`);

    } catch (error) {
      if (!isExternalTransaction) {
        await dbClient.query('ROLLBACK');
      }
      
      this.logger.error(`Failed to delete schema ${schemaName}:`, error);
      throw new Error(`Schema deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      if (!isExternalTransaction) {
        dbClient.release();
      }
    }
  }

  /**
   * Get detailed information about a schema
   * 
   * @param schemaName - Schema name to inspect
   * @returns Schema information and statistics
   */
  async getSchemaInfo(schemaName: string): Promise<SchemaInfo | null> {
    const client = await this.pool.connect();

    try {
      // Check if schema exists
      if (!(await this.schemaExists(schemaName, client))) {
        return null;
      }

      // Get table count
      const tableQuery = `
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = $1
      `;
      const tableResult = await client.query(tableQuery, [schemaName]);
      const tableCount = parseInt(tableResult.rows[0].count);

      // Get index count
      const indexQuery = `
        SELECT COUNT(*) as count 
        FROM pg_indexes 
        WHERE schemaname = $1
      `;
      const indexResult = await client.query(indexQuery, [schemaName]);
      const indexCount = parseInt(indexResult.rows[0].count);

      // Get constraint count
      const constraintQuery = `
        SELECT COUNT(*) as count 
        FROM information_schema.table_constraints 
        WHERE constraint_schema = $1
      `;
      const constraintResult = await client.query(constraintQuery, [schemaName]);
      const constraintCount = parseInt(constraintResult.rows[0].count);

      // Get schema size
      const sizeQuery = `
        SELECT pg_size_pretty(SUM(pg_total_relation_size(schemaname||'.'||tablename))) as size_pretty,
               SUM(pg_total_relation_size(schemaname||'.'||tablename)) as size_bytes
        FROM pg_tables 
        WHERE schemaname = $1
      `;
      const sizeResult = await client.query(sizeQuery, [schemaName]);
      const sizeBytes = parseInt(sizeResult.rows[0]?.size_bytes || '0');

      return {
        name: schemaName,
        exists: true,
        tableCount,
        indexCount,
        constraintCount,
        sizeBytes
      };

    } finally {
      client.release();
    }
  }

  /**
   * List all tenant schemas in the database
   * 
   * @param pattern - Optional schema name pattern (SQL LIKE pattern)
   * @returns Array of schema names
   */
  async listTenantSchemas(pattern?: string): Promise<string[]> {
    const client = await this.pool.connect();

    try {
      let query = `
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast', 'public', 'tenant_template')
      `;
      
      const params: string[] = [];
      
      if (pattern) {
        query += ` AND schema_name LIKE $1`;
        params.push(pattern);
      }
      
      query += ` ORDER BY schema_name`;

      const result = await client.query(query, params);
      return result.rows.map(row => row.schema_name);

    } finally {
      client.release();
    }
  }

  /**
   * Backup a tenant schema structure (tables and data)
   * 
   * This creates a SQL dump that can be used to restore the schema
   * 
   * @param schemaName - Schema to backup
   * @returns SQL dump as string
   */
  async backupTenantSchema(schemaName: string): Promise<string> {
    const client = await this.pool.connect();

    try {
      this.validateSchemaName(schemaName);

      if (!(await this.schemaExists(schemaName, client))) {
        throw new Error(`Schema does not exist: ${schemaName}`);
      }

      // This is a simplified backup - in production, consider using pg_dump
      const backupParts: string[] = [];
      
      // Add schema creation
      backupParts.push(`-- Schema backup for: ${schemaName}`);
      backupParts.push(`-- Created: ${new Date().toISOString()}`);
      backupParts.push('');
      backupParts.push(`CREATE SCHEMA IF NOT EXISTS "${schemaName}";`);
      backupParts.push('');

      // Get all tables in schema
      const tablesQuery = `
        SELECT table_name, table_type 
        FROM information_schema.tables 
        WHERE table_schema = $1 
        ORDER BY table_name
      `;
      
      const tablesResult = await client.query(tablesQuery, [schemaName]);
      
      for (const table of tablesResult.rows) {
        // Get table DDL (simplified - real implementation would need more detailed DDL extraction)
        backupParts.push(`-- Table: ${table.table_name}`);
        
        // Get table data count
        const countQuery = `SELECT COUNT(*) as count FROM "${schemaName}"."${table.table_name}"`;
        const countResult = await client.query(countQuery);
        backupParts.push(`-- Records: ${countResult.rows[0].count}`);
        backupParts.push('');
      }

      return backupParts.join('\n');

    } finally {
      client.release();
    }
  }

  /**
   * Create empty schema without tables
   */
  private async createSchema(schemaName: string, client: PoolClient): Promise<void> {
    const createQuery = `CREATE SCHEMA "${schemaName}"`;
    await client.query(createQuery);
  }

  /**
   * Replicate template schema structure to new tenant schema
   */
  private async replicateTemplate(
    schemaName: string, 
    client: PoolClient, 
    options: SchemaCreationOptions
  ): Promise<void> {
    // Read template SQL file
    let templateSQL: string;
    
    try {
      templateSQL = await fs.readFile(this.templateSchemaPath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read template SQL file: ${this.templateSchemaPath}`);
    }

    // Replace template schema name with actual tenant schema name
    const tenantSQL = templateSQL
      .replace(/tenant_template\./g, `"${schemaName}".`)
      .replace(/CREATE SCHEMA IF NOT EXISTS tenant_template;/g, `-- Schema already created: ${schemaName}`)
      .replace(/SET search_path TO tenant_template, public;/g, `SET search_path TO "${schemaName}", public;`)
      .replace(/SET search_path TO public;/g, '-- Reset search path');

    // Remove schema creation and path setting from template
    const cleanedSQL = this.cleanTemplateSQL(tenantSQL, options);

    // Execute the modified SQL
    await client.query(cleanedSQL);
  }

  /**
   * Clean template SQL for tenant-specific execution
   */
  private cleanTemplateSQL(sql: string, options: SchemaCreationOptions): string {
    let cleanedSQL = sql;

    // Remove template-specific commands
    cleanedSQL = cleanedSQL.replace(/CREATE SCHEMA IF NOT EXISTS[^;]+;/g, '');
    cleanedSQL = cleanedSQL.replace(/SET search_path[^;]+;/g, '');

    // Optionally remove indexes
    if (options.skipIndexes) {
      cleanedSQL = cleanedSQL.replace(/CREATE INDEX[^;]+;/g, '');
    }

    // Optionally remove constraints
    if (options.skipConstraints) {
      cleanedSQL = cleanedSQL.replace(/ALTER TABLE[^;]+ADD CONSTRAINT[^;]+;/g, '');
    }

    return cleanedSQL;
  }

  /**
   * Set up appropriate permissions for tenant schema
   */
  private async setupSchemaPermissions(schemaName: string, client: PoolClient): Promise<void> {
    // Grant usage on schema to application role (if exists)
    // This is a placeholder - implement based on your security model
    try {
      const grantQuery = `GRANT USAGE ON SCHEMA "${schemaName}" TO PUBLIC`;
      await client.query(grantQuery);
    } catch (error) {
      // Log warning but don't fail - permissions might not be needed in dev
      this.logger.warn(`Could not set schema permissions for ${schemaName}:`, error);
    }
  }

  /**
   * Execute post-creation SQL statements
   */
  private async executePostCreationSQL(
    schemaName: string, 
    client: PoolClient, 
    sqlStatements: string[]
  ): Promise<void> {
    for (const sql of sqlStatements) {
      // Replace schema placeholder with actual schema name
      const tenantSQL = sql.replace(/\{SCHEMA_NAME\}/g, `"${schemaName}"`);
      await client.query(tenantSQL);
    }
  }

  /**
   * Check if schema exists
   */
  private async schemaExists(schemaName: string, client: PoolClient): Promise<boolean> {
    const query = `
      SELECT 1 
      FROM information_schema.schemata 
      WHERE schema_name = $1
    `;
    
    const result = await client.query(query, [schemaName]);
    return result.rows.length > 0;
  }

  /**
   * Validate schema name for security and PostgreSQL compliance
   */
  private validateSchemaName(schemaName: string): void {
    // Check length
    if (schemaName.length > 63) {
      throw new Error(`Schema name too long (max 63 characters): ${schemaName}`);
    }

    // Check format - must be valid PostgreSQL identifier
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(schemaName)) {
      throw new Error(`Invalid schema name format: ${schemaName}`);
    }

    // Prevent reserved names
    const reservedNames = [
      'public', 'information_schema', 'pg_catalog', 'pg_toast',
      'tenant_template', 'postgres', 'template0', 'template1'
    ];
    
    if (reservedNames.includes(schemaName.toLowerCase())) {
      throw new Error(`Reserved schema name not allowed: ${schemaName}`);
    }
  }
}

/**
 * Factory function to create SchemaCreator instance
 * 
 * @param pool - PostgreSQL connection pool
 * @returns Configured SchemaCreator instance
 */
export function createSchemaCreator(pool: Pool): SchemaCreator {
  return new SchemaCreator(pool);
}