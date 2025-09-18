-- =====================================================
-- Migration 002: Create Tenant Template Schema
-- External Metrics Web Service - Multi-tenant Database Setup
-- =====================================================
--
-- This migration creates the template schema that will be
-- replicated for each tenant organization. The template
-- contains all tables and structures needed for tenant
-- data isolation in the multi-tenant architecture.
--
-- Migration Details:
-- - Creates tenant_template schema with all tenant tables
-- - Sets up users, metrics_sessions, tool_metrics, dashboard_configs
-- - Adds comprehensive indexes for dashboard performance
-- - Implements data validation constraints and triggers
-- - Provides complete rollback instructions
--
-- Requirements:
-- - Migration 001 must be applied first (master tenant registry)
-- - PostgreSQL 14+ with UUID support
-- - Sufficient storage for template schema and future tenant data
-- =====================================================

-- Migration metadata
-- migration_id: 002
-- description: Create tenant template schema with all tenant tables
-- author: External Metrics Development Team
-- created_at: 2025-09-06
-- depends_on: 001_create_master_tenant.sql

-- =====================================================
-- UP Migration - Apply Changes
-- =====================================================

BEGIN;

-- Create the template schema that will be used as a template for all tenant schemas
CREATE SCHEMA IF NOT EXISTS tenant_template;

-- Set search path to work within the template schema
SET search_path TO tenant_template, public;

-- =====================================================
-- Users Table - Tenant User Management
-- =====================================================

CREATE TABLE users (
    -- Primary identifier
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- User authentication and contact information
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    
    -- Role-based access control
    role VARCHAR(50) NOT NULL DEFAULT 'developer',
    
    -- Single Sign-On integration
    sso_provider VARCHAR(50), 
    sso_user_id VARCHAR(255), 
    
    -- User activity tracking
    last_login TIMESTAMP WITH TIME ZONE,
    login_count INTEGER DEFAULT 0,
    
    -- User preferences and settings
    timezone VARCHAR(50) DEFAULT 'UTC',
    preferences JSONB DEFAULT '{}'::jsonb,
    
    -- Account status and metadata
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- Metrics Sessions Table - Productivity Session Tracking
-- =====================================================

CREATE TABLE metrics_sessions (
    -- Primary identifier
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- User who owns this session
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Session timing information
    session_start TIMESTAMP WITH TIME ZONE NOT NULL,
    session_end TIMESTAMP WITH TIME ZONE,
    total_duration_ms BIGINT,
    
    -- Session metadata and analysis
    tools_used JSONB, 
    productivity_score INTEGER CHECK (productivity_score >= 0 AND productivity_score <= 100),
    
    -- Session categorization and context
    session_type VARCHAR(50) DEFAULT 'development',
    project_id VARCHAR(100), 
    tags JSONB DEFAULT '[]'::jsonb, 
    
    -- Quality metrics
    interruptions_count INTEGER DEFAULT 0,
    focus_time_ms BIGINT DEFAULT 0,
    
    -- Session notes and description
    description TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- Tool Metrics Table - Individual Tool Usage Tracking
-- =====================================================

CREATE TABLE tool_metrics (
    -- Primary identifier
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Session this tool usage belongs to
    session_id UUID NOT NULL REFERENCES metrics_sessions(id) ON DELETE CASCADE,
    
    -- Tool identification
    tool_name VARCHAR(100) NOT NULL,
    tool_category VARCHAR(50), 
    
    -- Usage statistics
    execution_count INTEGER NOT NULL DEFAULT 1,
    total_duration_ms BIGINT NOT NULL,
    average_duration_ms BIGINT GENERATED ALWAYS AS (
        CASE 
            WHEN execution_count > 0 THEN total_duration_ms / execution_count 
            ELSE 0 
        END
    ) STORED,
    
    -- Quality and reliability metrics
    success_rate DECIMAL(5,4) NOT NULL CHECK (success_rate >= 0 AND success_rate <= 1),
    error_count INTEGER DEFAULT 0,
    
    -- Performance metrics
    memory_usage_mb INTEGER,
    cpu_time_ms BIGINT,
    
    -- Tool-specific metadata
    parameters JSONB, 
    output_size_bytes BIGINT, 
    
    -- Context and categorization
    command_line TEXT, 
    working_directory VARCHAR(500),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- Dashboard Configurations Table - User Dashboard Layouts
-- =====================================================

CREATE TABLE dashboard_configs (
    -- Primary identifier
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- User who owns this dashboard configuration
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Dashboard identification and metadata
    dashboard_name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Widget layout and configuration
    widget_layout JSONB NOT NULL, 
    
    -- Dashboard settings
    is_default BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT false, 
    refresh_interval_seconds INTEGER DEFAULT 30,
    
    -- Access and sharing
    shared_with_roles JSONB DEFAULT '[]'::jsonb, 
    
    -- Version control for dashboard evolution
    version INTEGER DEFAULT 1,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- Performance Indexes - Optimized for Dashboard Queries
-- =====================================================

-- Users table indexes
CREATE INDEX idx_users_email ON users(email) WHERE is_active = true;
CREATE INDEX idx_users_sso ON users(sso_provider, sso_user_id) WHERE is_active = true;
CREATE INDEX idx_users_role ON users(role) WHERE is_active = true;
CREATE INDEX idx_users_last_login ON users(last_login DESC) WHERE is_active = true;

-- Metrics sessions indexes - Critical for dashboard performance
CREATE INDEX idx_metrics_sessions_user_date ON metrics_sessions(user_id, session_start DESC);
CREATE INDEX idx_metrics_sessions_date_range ON metrics_sessions(session_start, session_end) WHERE session_end IS NOT NULL;
CREATE INDEX idx_metrics_sessions_type ON metrics_sessions(session_type, session_start DESC);
CREATE INDEX idx_metrics_sessions_project ON metrics_sessions(project_id, session_start DESC) WHERE project_id IS NOT NULL;
CREATE INDEX idx_metrics_sessions_productivity ON metrics_sessions(productivity_score DESC, session_start DESC) WHERE productivity_score IS NOT NULL;

-- Tool metrics indexes - For tool usage analytics
CREATE INDEX idx_tool_metrics_session ON tool_metrics(session_id, created_at DESC);
CREATE INDEX idx_tool_metrics_name_date ON tool_metrics(tool_name, created_at DESC);
CREATE INDEX idx_tool_metrics_category_date ON tool_metrics(tool_category, created_at DESC) WHERE tool_category IS NOT NULL;
CREATE INDEX idx_tool_metrics_success_rate ON tool_metrics(success_rate DESC, total_duration_ms ASC);

-- Dashboard configs indexes
CREATE INDEX idx_dashboard_configs_user ON dashboard_configs(user_id, updated_at DESC);
CREATE INDEX idx_dashboard_configs_default ON dashboard_configs(user_id, is_default) WHERE is_default = true;
CREATE INDEX idx_dashboard_configs_public ON dashboard_configs(is_public, updated_at DESC) WHERE is_public = true;

-- =====================================================
-- Constraints and Data Validation
-- =====================================================

-- Ensure only one default dashboard per user
CREATE UNIQUE INDEX idx_unique_default_dashboard 
ON dashboard_configs(user_id) 
WHERE is_default = true;

-- Validate role values
ALTER TABLE users ADD CONSTRAINT chk_user_role_values 
CHECK (role IN ('admin', 'manager', 'developer', 'viewer'));

-- Validate session timing logic
ALTER TABLE metrics_sessions ADD CONSTRAINT chk_session_timing 
CHECK (session_end IS NULL OR session_end >= session_start);

-- Ensure total_duration_ms matches session timing when both are present
ALTER TABLE metrics_sessions ADD CONSTRAINT chk_session_duration 
CHECK (
    (session_end IS NULL OR total_duration_ms IS NULL) OR 
    (total_duration_ms >= 0 AND total_duration_ms <= EXTRACT(EPOCH FROM (session_end - session_start)) * 1000 + 1000)
);

-- Validate tool metrics ranges
ALTER TABLE tool_metrics ADD CONSTRAINT chk_tool_execution_count 
CHECK (execution_count > 0);

ALTER TABLE tool_metrics ADD CONSTRAINT chk_tool_duration 
CHECK (total_duration_ms >= 0);

-- Dashboard refresh interval should be reasonable (5 seconds to 1 hour)
ALTER TABLE dashboard_configs ADD CONSTRAINT chk_refresh_interval 
CHECK (refresh_interval_seconds >= 5 AND refresh_interval_seconds <= 3600);

-- =====================================================
-- Triggers for Automatic Updates
-- =====================================================

-- Function to update updated_at timestamp (scoped to tenant_template schema)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER trigger_update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_update_sessions_updated_at
    BEFORE UPDATE ON metrics_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_update_dashboard_configs_updated_at
    BEFORE UPDATE ON dashboard_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- Table and Column Documentation
-- =====================================================

-- Users table comments
COMMENT ON TABLE users IS 'User accounts within tenant organization with SSO support and role-based access control';
COMMENT ON COLUMN users.role IS 'User role determining access permissions: admin, manager, developer, viewer';
COMMENT ON COLUMN users.sso_provider IS 'External SSO provider integration (google, microsoft, okta, etc.)';
COMMENT ON COLUMN users.preferences IS 'User-specific UI and behavior preferences stored as JSON';

-- Metrics sessions table comments
COMMENT ON TABLE metrics_sessions IS 'Individual work sessions with productivity tracking and comprehensive analytics';
COMMENT ON COLUMN metrics_sessions.tools_used IS 'JSON array of tools used during this session with usage counts';
COMMENT ON COLUMN metrics_sessions.productivity_score IS 'Calculated productivity score (0-100) based on session metrics and patterns';
COMMENT ON COLUMN metrics_sessions.focus_time_ms IS 'Time spent in focused work state without interruptions or context switches';

-- Tool metrics table comments
COMMENT ON TABLE tool_metrics IS 'Detailed tool usage statistics within work sessions for granular productivity analysis';
COMMENT ON COLUMN tool_metrics.success_rate IS 'Decimal rate (0.0-1.0) of successful tool executions vs total attempts';
COMMENT ON COLUMN tool_metrics.parameters IS 'JSON storage of tool parameters and configuration used during execution';
COMMENT ON COLUMN tool_metrics.average_duration_ms IS 'Computed column: average execution time per tool invocation';

-- Dashboard configs table comments
COMMENT ON TABLE dashboard_configs IS 'Customizable dashboard layouts and widget configurations for personalized productivity views';
COMMENT ON COLUMN dashboard_configs.widget_layout IS 'Complete JSON specification of dashboard layout, widgets, and their configurations';
COMMENT ON COLUMN dashboard_configs.shared_with_roles IS 'JSON array of user roles that can access and view this dashboard configuration';

-- Reset search path
SET search_path TO public;

-- Log successful migration
DO $$
BEGIN
    RAISE NOTICE 'Migration 002 completed successfully: Tenant template schema created';
    RAISE NOTICE 'Created schema: tenant_template with % tables', 
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'tenant_template');
    RAISE NOTICE 'Total indexes created: %', 
        (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'tenant_template');
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
-- -- Drop the entire tenant template schema and all its contents
-- DROP SCHEMA IF EXISTS tenant_template CASCADE;
-- 
-- -- Note: CASCADE will automatically remove all tables, indexes, 
-- -- triggers, and functions within the schema
-- 
-- COMMIT;
-- 
-- WARNING: This rollback will permanently delete the template schema
-- and make it impossible to create new tenant schemas until the
-- migration is re-applied. Ensure all tenant data is backed up
-- before executing rollback commands.
-- 
-- =====================================================