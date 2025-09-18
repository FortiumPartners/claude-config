-- =====================================================
-- Fortium External Metrics Web Service
-- Database Initialization Script
-- =====================================================

-- Create extensions required for the application
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- Create public schema tables (tenant registry)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) UNIQUE NOT NULL,
    schema_name VARCHAR(63) UNIQUE NOT NULL,
    subscription_plan VARCHAR(50) DEFAULT 'basic',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    admin_email VARCHAR(255),
    billing_email VARCHAR(255),
    data_region VARCHAR(50) DEFAULT 'us-east-1',
    compliance_settings JSONB DEFAULT '{}'
);

-- =====================================================
-- Create tenant template schema
-- =====================================================

CREATE SCHEMA IF NOT EXISTS tenant_template;

-- Users table in tenant template
CREATE TABLE IF NOT EXISTS tenant_template.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) DEFAULT 'developer',
    password VARCHAR(255),
    sso_provider VARCHAR(50),
    sso_user_id VARCHAR(255),
    last_login TIMESTAMPTZ,
    login_count INTEGER DEFAULT 0,
    timezone VARCHAR(50) DEFAULT 'UTC',
    preferences JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Metrics sessions table
CREATE TABLE IF NOT EXISTS tenant_template.metrics_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    session_start TIMESTAMPTZ NOT NULL,
    session_end TIMESTAMPTZ,
    total_duration_ms BIGINT,
    tools_used JSONB,
    productivity_score INTEGER,
    session_type VARCHAR(50) DEFAULT 'development',
    project_id VARCHAR(100),
    tags JSONB DEFAULT '[]',
    interruptions_count INTEGER DEFAULT 0,
    focus_time_ms BIGINT DEFAULT 0,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES tenant_template.users(id) ON DELETE CASCADE
);

-- Tool metrics table
CREATE TABLE IF NOT EXISTS tenant_template.tool_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL,
    tool_name VARCHAR(100) NOT NULL,
    tool_category VARCHAR(50),
    execution_count INTEGER DEFAULT 1,
    total_duration_ms BIGINT NOT NULL,
    average_duration_ms BIGINT NOT NULL,
    success_rate DECIMAL(5,4) NOT NULL,
    error_count INTEGER DEFAULT 0,
    memory_usage_mb INTEGER,
    cpu_time_ms BIGINT,
    parameters JSONB,
    output_size_bytes BIGINT,
    command_line TEXT,
    working_directory VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (session_id) REFERENCES tenant_template.metrics_sessions(id) ON DELETE CASCADE
);

-- Dashboard configurations table
CREATE TABLE IF NOT EXISTS tenant_template.dashboard_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    dashboard_name VARCHAR(100) NOT NULL,
    description TEXT,
    widget_layout JSONB NOT NULL,
    is_default BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT false,
    refresh_interval_seconds INTEGER DEFAULT 30,
    shared_with_roles JSONB DEFAULT '[]',
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES tenant_template.users(id) ON DELETE CASCADE,
    CONSTRAINT unique_default_dashboard UNIQUE (user_id, is_default)
);

-- Activity data table
CREATE TABLE IF NOT EXISTS tenant_template.activity_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    action_name VARCHAR(100) NOT NULL,
    action_description TEXT NOT NULL,
    target_name VARCHAR(200) NOT NULL,
    target_type VARCHAR(50) DEFAULT 'unknown',
    status VARCHAR(20) DEFAULT 'success',
    priority INTEGER DEFAULT 0,
    is_automated BOOLEAN DEFAULT false,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    duration INTEGER,
    completed_at TIMESTAMPTZ,
    metadata JSONB,
    tags JSONB DEFAULT '[]',
    project_id VARCHAR(100),
    error_message TEXT,
    error_code VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES tenant_template.users(id) ON DELETE CASCADE
);

-- =====================================================
-- Functions for tenant management
-- =====================================================

-- Function to create a new tenant schema
CREATE OR REPLACE FUNCTION create_tenant_schema(tenant_schema_name VARCHAR(63))
RETURNS VOID AS $$
BEGIN
    -- Create the schema
    EXECUTE 'CREATE SCHEMA IF NOT EXISTS ' || quote_ident(tenant_schema_name);
    
    -- Create tables by copying from template
    EXECUTE 'CREATE TABLE ' || quote_ident(tenant_schema_name) || '.users (LIKE tenant_template.users INCLUDING ALL)';
    EXECUTE 'CREATE TABLE ' || quote_ident(tenant_schema_name) || '.metrics_sessions (LIKE tenant_template.metrics_sessions INCLUDING ALL)';
    EXECUTE 'CREATE TABLE ' || quote_ident(tenant_schema_name) || '.tool_metrics (LIKE tenant_template.tool_metrics INCLUDING ALL)';
    EXECUTE 'CREATE TABLE ' || quote_ident(tenant_schema_name) || '.dashboard_configs (LIKE tenant_template.dashboard_configs INCLUDING ALL)';
    EXECUTE 'CREATE TABLE ' || quote_ident(tenant_schema_name) || '.activity_data (LIKE tenant_template.activity_data INCLUDING ALL)';
    
    -- Recreate foreign key constraints
    EXECUTE 'ALTER TABLE ' || quote_ident(tenant_schema_name) || '.metrics_sessions ADD FOREIGN KEY (user_id) REFERENCES ' || quote_ident(tenant_schema_name) || '.users(id) ON DELETE CASCADE';
    EXECUTE 'ALTER TABLE ' || quote_ident(tenant_schema_name) || '.tool_metrics ADD FOREIGN KEY (session_id) REFERENCES ' || quote_ident(tenant_schema_name) || '.metrics_sessions(id) ON DELETE CASCADE';
    EXECUTE 'ALTER TABLE ' || quote_ident(tenant_schema_name) || '.dashboard_configs ADD FOREIGN KEY (user_id) REFERENCES ' || quote_ident(tenant_schema_name) || '.users(id) ON DELETE CASCADE';
    EXECUTE 'ALTER TABLE ' || quote_ident(tenant_schema_name) || '.activity_data ADD FOREIGN KEY (user_id) REFERENCES ' || quote_ident(tenant_schema_name) || '.users(id) ON DELETE CASCADE';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Insert demo tenant and create its schema
-- =====================================================

-- Insert demo tenant
INSERT INTO public.tenants (
    id,
    name,
    domain,
    schema_name,
    subscription_plan,
    admin_email,
    billing_email,
    metadata
) VALUES (
    '12345678-1234-4567-8901-123456789012',
    'Fortium Demo Organization',
    'fortium.com',
    'tenant_fortium_demo',
    'enterprise',
    'demo@fortium.com',
    'billing@fortium.com',
    '{"demo": true, "environment": "development"}'
) ON CONFLICT (id) DO NOTHING;

-- Create the demo tenant schema
SELECT create_tenant_schema('tenant_fortium_demo');

-- =====================================================
-- Insert demo user into tenant schema
-- =====================================================

INSERT INTO tenant_fortium_demo.users (
    id,
    email,
    first_name,
    last_name,
    role,
    password,
    timezone,
    preferences,
    is_active,
    login_count
) VALUES (
    '12345678-1234-4567-8901-123456789013',
    'demo@fortium.com',
    'Demo',
    'User',
    'admin',
    -- For now, we'll use a simple password. In production, this should be properly hashed
    'password123',
    'UTC',
    '{"theme": "dark", "notifications": true}',
    true,
    0
) ON CONFLICT (email) DO NOTHING;

-- =====================================================
-- Insert sample activity data for demo user
-- =====================================================

INSERT INTO tenant_fortium_demo.activity_data (
    user_id,
    action_name,
    action_description,
    target_name,
    target_type,
    status,
    priority,
    metadata,
    tags
) VALUES 
(
    '12345678-1234-4567-8901-123456789013',
    'Login',
    'User logged into the system',
    'Authentication System',
    'auth',
    'success',
    1,
    '{"source": "web", "browser": "Chrome"}',
    '["authentication", "security"]'
),
(
    '12345678-1234-4567-8901-123456789013',
    'Dashboard View',
    'User accessed the main dashboard',
    'Main Dashboard',
    'dashboard',
    'success',
    0,
    '{"load_time_ms": 1250, "widgets_loaded": 6}',
    '["dashboard", "ui"]'
),
(
    '12345678-1234-4567-8901-123456789013',
    'Metrics Query',
    'User executed a metrics query',
    'Performance Metrics',
    'query',
    'success',
    2,
    '{"query_time_ms": 450, "results_count": 1247}',
    '["metrics", "query", "performance"]'
) ON CONFLICT DO NOTHING;

-- =====================================================
-- Create indexes for better performance
-- =====================================================

-- Indexes on public schema
CREATE INDEX IF NOT EXISTS idx_tenants_domain ON public.tenants(domain);
CREATE INDEX IF NOT EXISTS idx_tenants_active ON public.tenants(is_active);
CREATE INDEX IF NOT EXISTS idx_tenants_schema_name ON public.tenants(schema_name);

-- Indexes on tenant template (will be inherited by tenant schemas)
CREATE INDEX IF NOT EXISTS idx_users_email ON tenant_template.users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON tenant_template.users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_sso ON tenant_template.users(sso_provider, sso_user_id);

CREATE INDEX IF NOT EXISTS idx_activity_user_timestamp ON tenant_template.activity_data(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_activity_status ON tenant_template.activity_data(status);
CREATE INDEX IF NOT EXISTS idx_activity_target_type ON tenant_template.activity_data(target_type);

CREATE INDEX IF NOT EXISTS idx_metrics_sessions_user ON tenant_template.metrics_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_metrics_sessions_start ON tenant_template.metrics_sessions(session_start DESC);

-- =====================================================
-- Grant permissions
-- =====================================================

-- Grant necessary permissions to the application user
GRANT CONNECT ON DATABASE fortium_metrics TO fortium_user;
GRANT USAGE ON SCHEMA public TO fortium_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO fortium_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO fortium_user;

GRANT USAGE ON SCHEMA tenant_template TO fortium_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA tenant_template TO fortium_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA tenant_template TO fortium_user;

GRANT USAGE ON SCHEMA tenant_fortium_demo TO fortium_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA tenant_fortium_demo TO fortium_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA tenant_fortium_demo TO fortium_user;

-- Grant function execution
GRANT EXECUTE ON FUNCTION create_tenant_schema(VARCHAR) TO fortium_user;

-- =====================================================
-- Success message
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE 'Database initialization completed successfully!';
    RAISE NOTICE 'Demo tenant created with ID: 12345678-1234-4567-8901-123456789012';
    RAISE NOTICE 'Demo user email: demo@fortium.com';
    RAISE NOTICE 'Demo user password: password123';
    RAISE NOTICE 'Tenant schema: tenant_fortium_demo';
END $$;