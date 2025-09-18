-- =====================================================
-- Master Tenant Registry Schema
-- External Metrics Web Service - Multi-tenant Database Design
-- =====================================================
-- 
-- This schema defines the master tenant registry that manages
-- all tenant organizations in the multi-tenant SaaS platform.
-- Each row represents a separate organization with their own
-- isolated schema in the database.
--
-- Schema-per-tenant approach ensures complete data isolation
-- between organizations while maintaining efficient querying
-- and management capabilities.
-- =====================================================

-- Master tenant registry table
-- This is the single source of truth for all tenant organizations
CREATE TABLE IF NOT EXISTS tenants (
    -- Primary identifier for the tenant
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Human-readable organization name (required)
    -- Used for billing, support, and admin interfaces
    name VARCHAR(255) NOT NULL,
    
    -- Unique domain identifier for the tenant
    -- Used for tenant resolution in multi-tenant requests
    -- Examples: 'fortium', 'acme-corp', 'startup-xyz'
    domain VARCHAR(255) UNIQUE NOT NULL,
    
    -- PostgreSQL schema name for this tenant's data
    -- Must be valid PostgreSQL identifier (max 63 chars)
    -- Auto-generated based on domain with validation
    schema_name VARCHAR(63) NOT NULL UNIQUE,
    
    -- Subscription plan tier
    -- Determines feature access and usage limits
    -- Values: 'basic', 'professional', 'enterprise', 'custom'
    subscription_plan VARCHAR(50) NOT NULL DEFAULT 'basic',
    
    -- Tenant creation timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Last modification timestamp (updated on any change)
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Soft delete flag (for data retention compliance)
    -- Inactive tenants retain data but block access
    is_active BOOLEAN DEFAULT true,
    
    -- Additional tenant metadata (JSON)
    -- Usage limits, feature flags, custom settings
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Billing and contact information
    admin_email VARCHAR(255),
    billing_email VARCHAR(255),
    
    -- Data residency and compliance settings
    data_region VARCHAR(50) DEFAULT 'us-east-1',
    compliance_settings JSONB DEFAULT '{}'::jsonb
);

-- =====================================================
-- Indexes for Performance Optimization
-- =====================================================

-- Primary lookup index for tenant resolution
-- Most queries will be by domain for tenant context
CREATE INDEX IF NOT EXISTS idx_tenants_domain ON tenants(domain) WHERE is_active = true;

-- Schema name lookup for internal operations
CREATE INDEX IF NOT EXISTS idx_tenants_schema_name ON tenants(schema_name) WHERE is_active = true;

-- Subscription plan queries for billing and feature access
CREATE INDEX IF NOT EXISTS idx_tenants_subscription_plan ON tenants(subscription_plan) WHERE is_active = true;

-- Admin operations - list tenants by creation date
CREATE INDEX IF NOT EXISTS idx_tenants_created_at ON tenants(created_at DESC) WHERE is_active = true;

-- Composite index for admin dashboard queries
CREATE INDEX IF NOT EXISTS idx_tenants_active_plan_created ON tenants(is_active, subscription_plan, created_at DESC);

-- =====================================================
-- Constraints and Validation
-- =====================================================

-- Ensure domain follows valid naming conventions
-- Only lowercase letters, numbers, and hyphens allowed
ALTER TABLE tenants ADD CONSTRAINT chk_domain_format 
CHECK (domain ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$' AND length(domain) >= 2);

-- Ensure schema name follows PostgreSQL identifier rules
-- Must start with letter, only letters/numbers/underscores
ALTER TABLE tenants ADD CONSTRAINT chk_schema_name_format 
CHECK (schema_name ~ '^[a-zA-Z][a-zA-Z0-9_]*$' AND length(schema_name) <= 63);

-- Validate subscription plan values
ALTER TABLE tenants ADD CONSTRAINT chk_subscription_plan_values 
CHECK (subscription_plan IN ('basic', 'professional', 'enterprise', 'custom'));

-- Validate email formats if provided
ALTER TABLE tenants ADD CONSTRAINT chk_admin_email_format 
CHECK (admin_email IS NULL OR admin_email ~ '^[^@]+@[^@]+\.[^@]+$');

ALTER TABLE tenants ADD CONSTRAINT chk_billing_email_format 
CHECK (billing_email IS NULL OR billing_email ~ '^[^@]+@[^@]+\.[^@]+$');

-- =====================================================
-- Audit and Trigger Setup
-- =====================================================

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_tenant_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at on row changes
DROP TRIGGER IF EXISTS trigger_update_tenant_updated_at ON tenants;
CREATE TRIGGER trigger_update_tenant_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION update_tenant_updated_at();

-- =====================================================
-- Initial Data and Comments
-- =====================================================

-- Add table and column comments for documentation
COMMENT ON TABLE tenants IS 'Master registry of all tenant organizations in the multi-tenant SaaS platform';
COMMENT ON COLUMN tenants.id IS 'Unique identifier for the tenant organization';
COMMENT ON COLUMN tenants.name IS 'Human-readable organization name for display and billing';
COMMENT ON COLUMN tenants.domain IS 'Unique domain identifier used for tenant resolution';
COMMENT ON COLUMN tenants.schema_name IS 'PostgreSQL schema name containing tenant data';
COMMENT ON COLUMN tenants.subscription_plan IS 'Current subscription tier determining feature access';
COMMENT ON COLUMN tenants.metadata IS 'Flexible JSON storage for tenant-specific configuration';
COMMENT ON COLUMN tenants.is_active IS 'Soft delete flag - inactive tenants retain data but block access';