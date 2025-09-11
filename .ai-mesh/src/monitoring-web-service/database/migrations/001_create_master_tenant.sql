-- =====================================================
-- Migration 001: Create Master Tenant Registry
-- External Metrics Web Service - Multi-tenant Database Setup
-- =====================================================
--
-- This migration creates the master tenant registry table
-- which serves as the single source of truth for all
-- tenant organizations in the multi-tenant SaaS platform.
--
-- Migration Details:
-- - Creates tenants table with full constraint validation
-- - Adds performance-optimized indexes
-- - Sets up audit triggers for automatic timestamp updates
-- - Includes rollback instructions for safe migration reversal
-- 
-- Requirements:
-- - PostgreSQL 14+ (for gen_random_uuid() support)
-- - Database user with CREATE TABLE permissions
-- - Sufficient storage for tenant registry growth
-- =====================================================

-- Migration metadata
-- This will be tracked in a migrations table (to be created in future migration)
-- migration_id: 001
-- description: Create master tenant registry
-- author: External Metrics Development Team
-- created_at: 2025-09-06

-- =====================================================
-- UP Migration - Apply Changes
-- =====================================================

BEGIN;

-- Ensure UUID extension is available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create master tenant registry table
CREATE TABLE IF NOT EXISTS tenants (
    -- Primary identifier for the tenant
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Human-readable organization name (required)
    name VARCHAR(255) NOT NULL,
    
    -- Unique domain identifier for tenant resolution
    domain VARCHAR(255) UNIQUE NOT NULL,
    
    -- PostgreSQL schema name for this tenant's data
    schema_name VARCHAR(63) NOT NULL UNIQUE,
    
    -- Subscription plan tier
    subscription_plan VARCHAR(50) NOT NULL DEFAULT 'basic',
    
    -- Audit timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Soft delete flag for data retention compliance
    is_active BOOLEAN DEFAULT true,
    
    -- Additional tenant metadata (JSON)
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Contact information
    admin_email VARCHAR(255),
    billing_email VARCHAR(255),
    
    -- Data residency and compliance
    data_region VARCHAR(50) DEFAULT 'us-east-1',
    compliance_settings JSONB DEFAULT '{}'::jsonb
);

-- =====================================================
-- Performance Indexes
-- =====================================================

-- Primary lookup index for tenant resolution
CREATE INDEX idx_tenants_domain ON tenants(domain) WHERE is_active = true;

-- Schema name lookup for internal operations
CREATE INDEX idx_tenants_schema_name ON tenants(schema_name) WHERE is_active = true;

-- Subscription plan queries for billing and features
CREATE INDEX idx_tenants_subscription_plan ON tenants(subscription_plan) WHERE is_active = true;

-- Admin operations - list tenants by creation date
CREATE INDEX idx_tenants_created_at ON tenants(created_at DESC) WHERE is_active = true;

-- Composite index for admin dashboard queries
CREATE INDEX idx_tenants_active_plan_created ON tenants(is_active, subscription_plan, created_at DESC);

-- =====================================================
-- Data Validation Constraints
-- =====================================================

-- Domain format validation (lowercase, alphanumeric, hyphens)
ALTER TABLE tenants ADD CONSTRAINT chk_domain_format 
CHECK (domain ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$' AND length(domain) >= 2);

-- PostgreSQL schema name validation
ALTER TABLE tenants ADD CONSTRAINT chk_schema_name_format 
CHECK (schema_name ~ '^[a-zA-Z][a-zA-Z0-9_]*$' AND length(schema_name) <= 63);

-- Subscription plan enumeration
ALTER TABLE tenants ADD CONSTRAINT chk_subscription_plan_values 
CHECK (subscription_plan IN ('basic', 'professional', 'enterprise', 'custom'));

-- Email format validation (if provided)
ALTER TABLE tenants ADD CONSTRAINT chk_admin_email_format 
CHECK (admin_email IS NULL OR admin_email ~ '^[^@]+@[^@]+\.[^@]+$');

ALTER TABLE tenants ADD CONSTRAINT chk_billing_email_format 
CHECK (billing_email IS NULL OR billing_email ~ '^[^@]+@[^@]+\.[^@]+$');

-- =====================================================
-- Audit Triggers
-- =====================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_tenant_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for automatic timestamp updates
CREATE TRIGGER trigger_update_tenant_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION update_tenant_updated_at();

-- =====================================================
-- Documentation and Comments
-- =====================================================

-- Table documentation
COMMENT ON TABLE tenants IS 'Master registry of all tenant organizations in the multi-tenant SaaS platform. Each row represents a separate organization with isolated data.';

-- Column documentation
COMMENT ON COLUMN tenants.id IS 'Unique identifier for the tenant organization (UUID)';
COMMENT ON COLUMN tenants.name IS 'Human-readable organization name for display and billing';
COMMENT ON COLUMN tenants.domain IS 'Unique domain identifier used for tenant resolution in requests';
COMMENT ON COLUMN tenants.schema_name IS 'PostgreSQL schema name containing all tenant-specific data tables';
COMMENT ON COLUMN tenants.subscription_plan IS 'Current subscription tier: basic, professional, enterprise, custom';
COMMENT ON COLUMN tenants.metadata IS 'Flexible JSON storage for tenant-specific configuration and settings';
COMMENT ON COLUMN tenants.is_active IS 'Soft delete flag - inactive tenants retain data but block access';
COMMENT ON COLUMN tenants.compliance_settings IS 'JSON configuration for data retention, privacy, and regulatory compliance';

-- =====================================================
-- Initial Data (Optional)
-- =====================================================

-- Insert system/demo tenant for testing and development
-- This can be removed in production if not needed
INSERT INTO tenants (
    name, 
    domain, 
    schema_name, 
    subscription_plan, 
    admin_email,
    metadata
) VALUES (
    'System Demo Account',
    'demo',
    'tenant_demo',
    'enterprise',
    'admin@demo.example.com',
    '{"demo_account": true, "features": {"advanced_analytics": true, "api_access": true}}'::jsonb
) ON CONFLICT (domain) DO NOTHING;

-- Log successful migration
DO $$
BEGIN
    RAISE NOTICE 'Migration 001 completed successfully: Master tenant registry created';
    RAISE NOTICE 'Created table: tenants with % constraints and % indexes', 
        (SELECT COUNT(*) FROM information_schema.check_constraints WHERE constraint_schema = 'public' AND table_name = 'tenants'),
        (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'tenants');
END $$;

COMMIT;

-- =====================================================
-- DOWN Migration - Rollback Instructions
-- =====================================================
-- 
-- To rollback this migration, execute the following commands:
-- 
-- BEGIN;
-- 
-- -- Drop all indexes
-- DROP INDEX IF EXISTS idx_tenants_active_plan_created;
-- DROP INDEX IF EXISTS idx_tenants_created_at;
-- DROP INDEX IF EXISTS idx_tenants_subscription_plan;
-- DROP INDEX IF EXISTS idx_tenants_schema_name;
-- DROP INDEX IF EXISTS idx_tenants_domain;
-- 
-- -- Drop trigger and function
-- DROP TRIGGER IF EXISTS trigger_update_tenant_updated_at ON tenants;
-- DROP FUNCTION IF EXISTS update_tenant_updated_at();
-- 
-- -- Drop table (WARNING: This will permanently delete all tenant data!)
-- DROP TABLE IF EXISTS tenants CASCADE;
-- 
-- -- Remove extension if not used elsewhere
-- -- DROP EXTENSION IF EXISTS "pgcrypto";
-- 
-- COMMIT;
-- 
-- =====================================================