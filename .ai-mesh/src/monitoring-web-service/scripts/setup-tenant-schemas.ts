#!/usr/bin/env npx tsx

import { PrismaClient } from '../src/generated/prisma-client'
import bcrypt from 'bcrypt'
import * as dotenv from 'dotenv'
import { Client } from 'pg'

// Load environment variables from parent directory
dotenv.config({ path: '../.env' })

const prisma = new PrismaClient()

// Function to create a new database client
function createDbClient() {
  return new Client({
    connectionString: process.env.DATABASE_URL
  })
}

async function createTenantSchema(tenantId: string, schemaName: string) {
  console.log(`📋 Creating schema ${schemaName} for tenant ${tenantId}...`)
  
  const client = createDbClient()
  
  try {
    await client.connect()
    
    // Create the tenant-specific schema
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}";`)
    console.log(`✅ Schema ${schemaName} created`)
    
    // Copy table structure from tenant_template
    const createTablesSQL = `
      -- Create users table
      CREATE TABLE IF NOT EXISTS "${schemaName}".users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'developer',
        password VARCHAR(255),
        sso_provider VARCHAR(50),
        sso_user_id VARCHAR(255),
        last_login TIMESTAMPTZ(6),
        login_count INTEGER NOT NULL DEFAULT 0,
        timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
        preferences JSONB NOT NULL DEFAULT '{}',
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()
      );

      -- Create metrics_sessions table
      CREATE TABLE IF NOT EXISTS "${schemaName}".metrics_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        session_start TIMESTAMPTZ(6) NOT NULL,
        session_end TIMESTAMPTZ(6),
        total_duration_ms BIGINT,
        tools_used JSONB,
        productivity_score INTEGER,
        session_type VARCHAR(50) NOT NULL DEFAULT 'development',
        project_id VARCHAR(100),
        tags JSONB NOT NULL DEFAULT '[]',
        interruptions_count INTEGER NOT NULL DEFAULT 0,
        focus_time_ms BIGINT NOT NULL DEFAULT 0,
        description TEXT,
        created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
        FOREIGN KEY (user_id) REFERENCES "${schemaName}".users(id) ON DELETE CASCADE
      );

      -- Create tool_metrics table
      CREATE TABLE IF NOT EXISTS "${schemaName}".tool_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL,
        tool_name VARCHAR(100) NOT NULL,
        tool_category VARCHAR(50),
        execution_count INTEGER NOT NULL DEFAULT 1,
        total_duration_ms BIGINT NOT NULL,
        average_duration_ms BIGINT NOT NULL,
        success_rate DECIMAL(5,4) NOT NULL,
        error_count INTEGER NOT NULL DEFAULT 0,
        memory_usage_mb INTEGER,
        cpu_time_ms BIGINT,
        parameters JSONB,
        output_size_bytes BIGINT,
        command_line TEXT,
        working_directory VARCHAR(500),
        created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
        FOREIGN KEY (session_id) REFERENCES "${schemaName}".metrics_sessions(id) ON DELETE CASCADE
      );

      -- Create dashboard_configs table
      CREATE TABLE IF NOT EXISTS "${schemaName}".dashboard_configs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        dashboard_name VARCHAR(100) NOT NULL,
        description TEXT,
        widget_layout JSONB NOT NULL,
        is_default BOOLEAN NOT NULL DEFAULT false,
        is_public BOOLEAN NOT NULL DEFAULT false,
        refresh_interval_seconds INTEGER NOT NULL DEFAULT 30,
        shared_with_roles JSONB NOT NULL DEFAULT '[]',
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
        FOREIGN KEY (user_id) REFERENCES "${schemaName}".users(id) ON DELETE CASCADE,
        UNIQUE (user_id, is_default) -- Ensure only one default dashboard per user
      );

      -- Create activity_data table
      CREATE TABLE IF NOT EXISTS "${schemaName}".activity_data (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        action_name VARCHAR(100) NOT NULL,
        action_description TEXT NOT NULL,
        target_name VARCHAR(200) NOT NULL,
        target_type VARCHAR(50) NOT NULL DEFAULT 'unknown',
        status VARCHAR(20) NOT NULL DEFAULT 'success',
        priority INTEGER NOT NULL DEFAULT 0,
        is_automated BOOLEAN NOT NULL DEFAULT false,
        timestamp TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
        duration INTEGER, -- Duration in milliseconds
        completed_at TIMESTAMPTZ(6),
        metadata JSONB,
        tags JSONB NOT NULL DEFAULT '[]',
        project_id VARCHAR(100),
        error_message TEXT,
        error_code VARCHAR(50),
        created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
        FOREIGN KEY (user_id) REFERENCES "${schemaName}".users(id) ON DELETE CASCADE
      );

      -- Create indexes for performance
      CREATE INDEX IF NOT EXISTS idx_${schemaName}_users_email ON "${schemaName}".users(email);
      CREATE INDEX IF NOT EXISTS idx_${schemaName}_users_active ON "${schemaName}".users(is_active);
      CREATE INDEX IF NOT EXISTS idx_${schemaName}_sessions_user ON "${schemaName}".metrics_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_${schemaName}_sessions_start ON "${schemaName}".metrics_sessions(session_start);
      CREATE INDEX IF NOT EXISTS idx_${schemaName}_tool_metrics_session ON "${schemaName}".tool_metrics(session_id);
      CREATE INDEX IF NOT EXISTS idx_${schemaName}_tool_metrics_tool ON "${schemaName}".tool_metrics(tool_name);
      CREATE INDEX IF NOT EXISTS idx_${schemaName}_dashboard_configs_user ON "${schemaName}".dashboard_configs(user_id);
      CREATE INDEX IF NOT EXISTS idx_${schemaName}_activity_data_user ON "${schemaName}".activity_data(user_id);
      CREATE INDEX IF NOT EXISTS idx_${schemaName}_activity_data_timestamp ON "${schemaName}".activity_data(timestamp);
      CREATE INDEX IF NOT EXISTS idx_${schemaName}_activity_data_status ON "${schemaName}".activity_data(status);
    `;
    
    await client.query(createTablesSQL)
    console.log(`✅ Tables created in schema ${schemaName}`)
    
    await client.end()
    
  } catch (error) {
    console.error(`❌ Error creating schema ${schemaName}:`, error)
    throw error
  }
}

async function seedTenantData(tenantId: string, schemaName: string) {
  console.log(`🌱 Seeding data for tenant schema ${schemaName}...`)
  
  const client = createDbClient()
  // Use raw queries to insert into the tenant-specific schema
  const hashedPassword = await bcrypt.hash('password123', 10)
  
  try {
    await client.connect()
    
    // Create demo user in tenant schema
    const demoUserQuery = `
      INSERT INTO "${schemaName}".users (
        email, first_name, last_name, password, role, timezone, preferences
      ) VALUES (
        'demo@fortium.com', 'Demo', 'User', $1, 'admin', 'America/Chicago', 
        '{"theme": "light", "language": "en"}'::jsonb
      ) ON CONFLICT (email) DO UPDATE SET
        password = EXCLUDED.password,
        updated_at = now()
      RETURNING id;
    `;
    
    const demoUserResult = await client.query(demoUserQuery, [hashedPassword])
    const demoUserId = demoUserResult.rows[0].id
    console.log(`✅ Demo user created in ${schemaName}:`, demoUserId)
    
    // Create admin user in tenant schema
    const adminUserQuery = `
      INSERT INTO "${schemaName}".users (
        email, first_name, last_name, password, role, timezone, preferences
      ) VALUES (
        'admin@example.com', 'Admin', 'User', $1, 'admin', 'America/Chicago', 
        '{"theme": "light", "language": "en"}'::jsonb
      ) ON CONFLICT (email) DO UPDATE SET
        password = EXCLUDED.password,
        updated_at = now()
      RETURNING id;
    `;
    
    const adminUserResult = await client.query(adminUserQuery, [hashedPassword])
    const adminUserId = adminUserResult.rows[0].id
    console.log(`✅ Admin user created in ${schemaName}:`, adminUserId)
    
    // Create sample activity data
    const activities = [
      {
        userId: demoUserId,
        actionName: 'File Update',
        actionDescription: 'Updated configuration file for production deployment',
        targetName: 'config/production.yml',
        status: 'success',
        timestamp: new Date(Date.now() - 5 * 60 * 1000),
        duration: 2500
      },
      {
        userId: demoUserId,
        actionName: 'Code Review', 
        actionDescription: 'Reviewed pull request #247 for real-time dashboard improvements',
        targetName: 'PR #247: Real-time Dashboard',
        status: 'success',
        timestamp: new Date(Date.now() - 15 * 60 * 1000),
        duration: 8200
      },
      {
        userId: demoUserId,
        actionName: 'Test Execution',
        actionDescription: 'Running end-to-end tests for user authentication flow',
        targetName: 'Authentication E2E Suite',
        status: 'in_progress',
        timestamp: new Date(Date.now() - 2 * 60 * 1000),
        duration: null
      }
    ]
    
    for (const activity of activities) {
      const insertActivityQuery = `
        INSERT INTO "${schemaName}".activity_data (
          user_id, action_name, action_description, target_name, status, timestamp, duration
        ) VALUES ($1, $2, $3, $4, $5, $6, $7);
      `;
      
      await client.query(insertActivityQuery, [
        activity.userId,
        activity.actionName,
        activity.actionDescription,
        activity.targetName,
        activity.status,
        activity.timestamp,
        activity.duration
      ])
    }
    
    console.log(`✅ Sample activity data created in ${schemaName}`)
    
    await client.end()
    
  } catch (error) {
    console.error(`❌ Error seeding data in schema ${schemaName}:`, error)
    throw error
  }
}

async function setupTenantSchemas() {
  console.log('🏗️  Setting up tenant schemas and demo data...')
  
  try {
    // Get all existing tenants
    const tenants = await prisma.tenant.findMany({
      where: {
        isActive: true
      }
    })
    
    console.log(`Found ${tenants.length} active tenants`)
    
    for (const tenant of tenants) {
      console.log(`\n🏢 Processing tenant: ${tenant.name} (${tenant.domain})`)
      
      // Create tenant-specific schema
      await createTenantSchema(tenant.id, tenant.schemaName)
      
      // Seed tenant data
      await seedTenantData(tenant.id, tenant.schemaName)
    }
    
    console.log('\n🎉 All tenant schemas set up successfully!')
    console.log('\n🔐 You can now login with:')
    console.log('  Email: demo@fortium.com')
    console.log('  Password: password123')
    console.log('  OR')
    console.log('  Email: admin@example.com')
    console.log('  Password: password123')
    
  } catch (error) {
    console.error('❌ Error setting up tenant schemas:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  setupTenantSchemas()
    .then(() => {
      console.log('✅ Tenant schema setup completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Tenant schema setup failed:', error)
      process.exit(1)
    })
}

export default setupTenantSchemas