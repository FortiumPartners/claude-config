-- =====================================================
-- Per-Tenant Schema Template
-- External Metrics Web Service - Multi-tenant Database Design
-- =====================================================
-- 
-- This template defines the complete schema structure that
-- will be replicated for each tenant organization. Each tenant
-- gets their own PostgreSQL schema with these tables, providing
-- complete data isolation between organizations.
--
-- All tables use UUID primary keys for better distributed
-- system compatibility and security (no predictable IDs).
--
-- Performance is optimized with strategic indexes on common
-- query patterns for real-time dashboard requirements.
-- =====================================================

-- Create template schema (used as template for new tenants)
CREATE SCHEMA IF NOT EXISTS tenant_template;

-- =====================================================
-- Users Table - Tenant User Management
-- =====================================================
-- Stores user accounts within each tenant organization
-- Supports both local users and SSO integration

CREATE TABLE IF NOT EXISTS tenant_template.users (
    -- Primary identifier for the user
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- User authentication and contact info
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    
    -- Role-based access control
    -- Values: 'admin', 'manager', 'developer', 'viewer'
    role VARCHAR(50) NOT NULL DEFAULT 'developer',
    
    -- Single Sign-On integration
    sso_provider VARCHAR(50), -- 'google', 'microsoft', 'okta', etc.
    sso_user_id VARCHAR(255), -- External provider user ID
    
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
-- Records individual work sessions with productivity metrics
-- Core table for time tracking and productivity analytics

CREATE TABLE IF NOT EXISTS tenant_template.metrics_sessions (
    -- Primary identifier for the session
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- User who owns this session
    user_id UUID NOT NULL REFERENCES tenant_template.users(id) ON DELETE CASCADE,
    
    -- Session timing information
    session_start TIMESTAMP WITH TIME ZONE NOT NULL,
    session_end TIMESTAMP WITH TIME ZONE,
    total_duration_ms BIGINT,
    
    -- Session metadata and analysis
    tools_used JSONB, -- Array of tools used in this session
    productivity_score INTEGER CHECK (productivity_score >= 0 AND productivity_score <= 100),
    
    -- Session categorization and context
    session_type VARCHAR(50) DEFAULT 'development', -- 'development', 'meeting', 'research'
    project_id VARCHAR(100), -- Optional project identifier
    tags JSONB DEFAULT '[]'::jsonb, -- User-defined tags
    
    -- Quality metrics
    interruptions_count INTEGER DEFAULT 0,
    focus_time_ms BIGINT DEFAULT 0, -- Time in focused state
    
    -- Session notes and description
    description TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- Tool Metrics Table - Individual Tool Usage Tracking
-- =====================================================
-- Detailed breakdown of tool usage within sessions
-- Enables tool-specific productivity analysis

CREATE TABLE IF NOT EXISTS tenant_template.tool_metrics (
    -- Primary identifier for the tool usage record
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Session this tool usage belongs to
    session_id UUID NOT NULL REFERENCES tenant_template.metrics_sessions(id) ON DELETE CASCADE,
    
    -- Tool identification
    tool_name VARCHAR(100) NOT NULL, -- 'Read', 'Write', 'Bash', etc.
    tool_category VARCHAR(50), -- 'file-ops', 'execution', 'search', etc.
    
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
    parameters JSONB, -- Tool parameters and options used
    output_size_bytes BIGINT, -- Size of tool output
    
    -- Context and categorization
    command_line TEXT, -- Full command executed (if applicable)
    working_directory VARCHAR(500),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- Dashboard Configurations Table - User Dashboard Layouts
-- =====================================================
-- Stores customized dashboard layouts and widget configurations
-- Supports personalized productivity views

CREATE TABLE IF NOT EXISTS tenant_template.dashboard_configs (
    -- Primary identifier for the dashboard configuration
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- User who owns this dashboard configuration
    user_id UUID NOT NULL REFERENCES tenant_template.users(id) ON DELETE CASCADE,
    
    -- Dashboard identification and metadata
    dashboard_name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Widget layout and configuration
    widget_layout JSONB NOT NULL, -- Complete dashboard layout specification
    
    -- Dashboard settings
    is_default BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT false, -- Can other users in tenant see this?
    refresh_interval_seconds INTEGER DEFAULT 30,
    
    -- Access and sharing
    shared_with_roles JSONB DEFAULT '[]'::jsonb, -- Roles that can access this dashboard
    
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
CREATE INDEX IF NOT EXISTS idx_users_email ON tenant_template.users(email) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_users_sso ON tenant_template.users(sso_provider, sso_user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_users_role ON tenant_template.users(role) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_users_last_login ON tenant_template.users(last_login DESC) WHERE is_active = true;

-- Metrics sessions indexes - Critical for dashboard performance
CREATE INDEX IF NOT EXISTS idx_metrics_sessions_user_date ON tenant_template.metrics_sessions(user_id, session_start DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_sessions_date_range ON tenant_template.metrics_sessions(session_start, session_end) WHERE session_end IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_metrics_sessions_type ON tenant_template.metrics_sessions(session_type, session_start DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_sessions_project ON tenant_template.metrics_sessions(project_id, session_start DESC) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_metrics_sessions_productivity ON tenant_template.metrics_sessions(productivity_score DESC, session_start DESC) WHERE productivity_score IS NOT NULL;

-- Tool metrics indexes - For tool usage analytics
CREATE INDEX IF NOT EXISTS idx_tool_metrics_session ON tenant_template.tool_metrics(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tool_metrics_name_date ON tenant_template.tool_metrics(tool_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tool_metrics_category_date ON tenant_template.tool_metrics(tool_category, created_at DESC) WHERE tool_category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tool_metrics_success_rate ON tenant_template.tool_metrics(success_rate DESC, total_duration_ms ASC);

-- Dashboard configs indexes
CREATE INDEX IF NOT EXISTS idx_dashboard_configs_user ON tenant_template.dashboard_configs(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_dashboard_configs_default ON tenant_template.dashboard_configs(user_id, is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_dashboard_configs_public ON tenant_template.dashboard_configs(is_public, updated_at DESC) WHERE is_public = true;

-- =====================================================
-- Constraints and Data Validation
-- =====================================================

-- Ensure only one default dashboard per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_default_dashboard 
ON tenant_template.dashboard_configs(user_id) 
WHERE is_default = true;

-- Validate role values
ALTER TABLE tenant_template.users ADD CONSTRAINT chk_user_role_values 
CHECK (role IN ('admin', 'manager', 'developer', 'viewer'));

-- Validate session timing logic
ALTER TABLE tenant_template.metrics_sessions ADD CONSTRAINT chk_session_timing 
CHECK (session_end IS NULL OR session_end >= session_start);

-- Ensure total_duration_ms matches session timing when both are present
ALTER TABLE tenant_template.metrics_sessions ADD CONSTRAINT chk_session_duration 
CHECK (
    (session_end IS NULL OR total_duration_ms IS NULL) OR 
    (total_duration_ms >= 0 AND total_duration_ms <= EXTRACT(EPOCH FROM (session_end - session_start)) * 1000 + 1000)
);

-- Validate tool metrics ranges
ALTER TABLE tenant_template.tool_metrics ADD CONSTRAINT chk_tool_execution_count 
CHECK (execution_count > 0);

ALTER TABLE tenant_template.tool_metrics ADD CONSTRAINT chk_tool_duration 
CHECK (total_duration_ms >= 0);

-- Dashboard refresh interval should be reasonable
ALTER TABLE tenant_template.dashboard_configs ADD CONSTRAINT chk_refresh_interval 
CHECK (refresh_interval_seconds >= 5 AND refresh_interval_seconds <= 3600);

-- =====================================================
-- Triggers for Automatic Updates
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION tenant_template.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER trigger_update_users_updated_at
    BEFORE UPDATE ON tenant_template.users
    FOR EACH ROW
    EXECUTE FUNCTION tenant_template.update_updated_at();

CREATE TRIGGER trigger_update_sessions_updated_at
    BEFORE UPDATE ON tenant_template.metrics_sessions
    FOR EACH ROW
    EXECUTE FUNCTION tenant_template.update_updated_at();

CREATE TRIGGER trigger_update_dashboard_configs_updated_at
    BEFORE UPDATE ON tenant_template.dashboard_configs
    FOR EACH ROW
    EXECUTE FUNCTION tenant_template.update_updated_at();

-- =====================================================
-- Table and Column Documentation
-- =====================================================

-- Users table comments
COMMENT ON TABLE tenant_template.users IS 'User accounts within tenant organization with SSO support';
COMMENT ON COLUMN tenant_template.users.role IS 'User role determining access permissions: admin, manager, developer, viewer';
COMMENT ON COLUMN tenant_template.users.sso_provider IS 'External SSO provider integration (google, microsoft, okta, etc.)';
COMMENT ON COLUMN tenant_template.users.preferences IS 'User-specific UI and behavior preferences stored as JSON';

-- Metrics sessions table comments
COMMENT ON TABLE tenant_template.metrics_sessions IS 'Individual work sessions with productivity tracking and analytics';
COMMENT ON COLUMN tenant_template.metrics_sessions.tools_used IS 'JSON array of tools used during this session';
COMMENT ON COLUMN tenant_template.metrics_sessions.productivity_score IS 'Calculated productivity score (0-100) based on session metrics';
COMMENT ON COLUMN tenant_template.metrics_sessions.focus_time_ms IS 'Time spent in focused work state without interruptions';

-- Tool metrics table comments
COMMENT ON TABLE tenant_template.tool_metrics IS 'Detailed tool usage statistics within work sessions';
COMMENT ON COLUMN tenant_template.tool_metrics.success_rate IS 'Decimal rate (0.0-1.0) of successful tool executions';
COMMENT ON COLUMN tenant_template.tool_metrics.parameters IS 'JSON storage of tool parameters and configuration used';

-- Dashboard configs table comments
COMMENT ON TABLE tenant_template.dashboard_configs IS 'Customizable dashboard layouts and widget configurations';
COMMENT ON COLUMN tenant_template.dashboard_configs.widget_layout IS 'Complete JSON specification of dashboard layout and widgets';
COMMENT ON COLUMN tenant_template.dashboard_configs.shared_with_roles IS 'JSON array of user roles that can access this dashboard';