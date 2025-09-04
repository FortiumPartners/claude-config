-- migrate:up

-- Create organizations table
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT organizations_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$'),
  CONSTRAINT organizations_slug_length CHECK (length(slug) >= 3 AND length(slug) <= 100)
);

-- Create users table  
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  role VARCHAR(50) NOT NULL DEFAULT 'developer',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_activity_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT users_email_format CHECK (email ~ '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$'),
  CONSTRAINT users_role_valid CHECK (role IN ('admin', 'manager', 'developer', 'viewer'))
);

-- Create unique constraint for email per organization
CREATE UNIQUE INDEX idx_users_org_email ON users (organization_id, email);

-- Create teams table
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT teams_name_not_empty CHECK (trim(name) != '')
);

-- Create unique constraint for team name per organization
CREATE UNIQUE INDEX idx_teams_org_name ON teams (organization_id, name);

-- Create team memberships table
CREATE TABLE team_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'member',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT team_memberships_role_valid CHECK (role IN ('lead', 'member'))
);

-- Create unique constraint for user per team
CREATE UNIQUE INDEX idx_team_memberships_team_user ON team_memberships (team_id, user_id);

-- Create command_executions hypertable
CREATE TABLE command_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  command_name VARCHAR(255) NOT NULL,
  execution_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  duration_ms INTEGER,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  context JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}'
);

-- Create agent_interactions hypertable
CREATE TABLE agent_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  agent_name VARCHAR(255) NOT NULL,
  interaction_type VARCHAR(100) NOT NULL,
  interaction_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  duration_ms INTEGER,
  success BOOLEAN NOT NULL DEFAULT true,
  input_tokens INTEGER,
  output_tokens INTEGER,
  context JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}'
);

-- Create user_sessions hypertable
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  session_end TIMESTAMP WITH TIME ZONE,
  commands_executed INTEGER DEFAULT 0,
  agents_used INTEGER DEFAULT 0,
  total_duration_ms INTEGER DEFAULT 0,
  context JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}'
);

-- Create productivity_metrics hypertable
CREATE TABLE productivity_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  metric_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  metric_type VARCHAR(100) NOT NULL,
  metric_value NUMERIC NOT NULL,
  metric_unit VARCHAR(50),
  context JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}'
);

-- Convert tables to hypertables (time-series)
SELECT create_hypertable('command_executions', 'execution_time', chunk_time_interval => INTERVAL '1 day');
SELECT create_hypertable('agent_interactions', 'interaction_time', chunk_time_interval => INTERVAL '1 day');
SELECT create_hypertable('user_sessions', 'session_start', chunk_time_interval => INTERVAL '1 day');
SELECT create_hypertable('productivity_metrics', 'metric_time', chunk_time_interval => INTERVAL '1 day');

-- Create indexes for performance
CREATE INDEX idx_command_executions_org_time ON command_executions (organization_id, execution_time DESC);
CREATE INDEX idx_command_executions_user_time ON command_executions (user_id, execution_time DESC);
CREATE INDEX idx_command_executions_team_time ON command_executions (team_id, execution_time DESC) WHERE team_id IS NOT NULL;
CREATE INDEX idx_command_executions_command_time ON command_executions (command_name, execution_time DESC);

CREATE INDEX idx_agent_interactions_org_time ON agent_interactions (organization_id, interaction_time DESC);
CREATE INDEX idx_agent_interactions_user_time ON agent_interactions (user_id, interaction_time DESC);
CREATE INDEX idx_agent_interactions_agent_time ON agent_interactions (agent_name, interaction_time DESC);

CREATE INDEX idx_user_sessions_org_time ON user_sessions (organization_id, session_start DESC);
CREATE INDEX idx_user_sessions_user_time ON user_sessions (user_id, session_start DESC);

CREATE INDEX idx_productivity_metrics_org_time ON productivity_metrics (organization_id, metric_time DESC);
CREATE INDEX idx_productivity_metrics_user_time ON productivity_metrics (user_id, metric_time DESC);
CREATE INDEX idx_productivity_metrics_type_time ON productivity_metrics (metric_type, metric_time DESC);

-- Create database roles for security
CREATE ROLE metrics_app_read;
CREATE ROLE metrics_app_write;
CREATE ROLE metrics_app_admin;

-- Grant basic permissions
GRANT CONNECT ON DATABASE claude_metrics TO metrics_app_read, metrics_app_write, metrics_app_admin;
GRANT USAGE ON SCHEMA public TO metrics_app_read, metrics_app_write, metrics_app_admin;

-- Read permissions
GRANT SELECT ON ALL TABLES IN SCHEMA public TO metrics_app_read;

-- Write permissions (includes read)
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO metrics_app_write;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO metrics_app_write;

-- Admin permissions (includes write)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO metrics_app_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO metrics_app_admin;
GRANT CREATE ON SCHEMA public TO metrics_app_admin;

-- Enable Row Level Security
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE command_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE productivity_metrics ENABLE ROW LEVEL SECURITY;

-- Create context function for RLS
CREATE OR REPLACE FUNCTION get_current_organization_id()
RETURNS UUID AS $$
BEGIN
  RETURN current_setting('app.current_organization_id', true)::UUID;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RLS policies for multi-tenancy
CREATE POLICY organizations_tenant_isolation ON organizations
  FOR ALL USING (id = get_current_organization_id());

CREATE POLICY users_tenant_isolation ON users
  FOR ALL USING (organization_id = get_current_organization_id());

CREATE POLICY teams_tenant_isolation ON teams
  FOR ALL USING (organization_id = get_current_organization_id());

CREATE POLICY team_memberships_tenant_isolation ON team_memberships
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM teams t 
      WHERE t.id = team_memberships.team_id 
      AND t.organization_id = get_current_organization_id()
    )
  );

CREATE POLICY command_executions_tenant_isolation ON command_executions
  FOR ALL USING (organization_id = get_current_organization_id());

CREATE POLICY agent_interactions_tenant_isolation ON agent_interactions
  FOR ALL USING (organization_id = get_current_organization_id());

CREATE POLICY user_sessions_tenant_isolation ON user_sessions
  FOR ALL USING (organization_id = get_current_organization_id());

CREATE POLICY productivity_metrics_tenant_isolation ON productivity_metrics
  FOR ALL USING (organization_id = get_current_organization_id());

-- migrate:down

-- Drop RLS policies
DROP POLICY IF EXISTS productivity_metrics_tenant_isolation ON productivity_metrics;
DROP POLICY IF EXISTS user_sessions_tenant_isolation ON user_sessions;
DROP POLICY IF EXISTS agent_interactions_tenant_isolation ON agent_interactions;
DROP POLICY IF EXISTS command_executions_tenant_isolation ON command_executions;
DROP POLICY IF EXISTS team_memberships_tenant_isolation ON team_memberships;
DROP POLICY IF EXISTS teams_tenant_isolation ON teams;
DROP POLICY IF EXISTS users_tenant_isolation ON users;
DROP POLICY IF EXISTS organizations_tenant_isolation ON organizations;

-- Drop context function
DROP FUNCTION IF EXISTS get_current_organization_id();

-- Disable Row Level Security
ALTER TABLE productivity_metrics DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE agent_interactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE command_executions DISABLE ROW LEVEL SECURITY;
ALTER TABLE team_memberships DISABLE ROW LEVEL SECURITY;
ALTER TABLE teams DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;

-- Revoke permissions and drop roles
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM metrics_app_admin;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM metrics_app_admin;
REVOKE CREATE ON SCHEMA public FROM metrics_app_admin;

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM metrics_app_write;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM metrics_app_write;

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM metrics_app_read;

REVOKE USAGE ON SCHEMA public FROM metrics_app_read, metrics_app_write, metrics_app_admin;
REVOKE CONNECT ON DATABASE claude_metrics FROM metrics_app_read, metrics_app_write, metrics_app_admin;

DROP ROLE IF EXISTS metrics_app_admin;
DROP ROLE IF EXISTS metrics_app_write;
DROP ROLE IF EXISTS metrics_app_read;

-- Drop indexes
DROP INDEX IF EXISTS idx_productivity_metrics_type_time;
DROP INDEX IF EXISTS idx_productivity_metrics_user_time;
DROP INDEX IF EXISTS idx_productivity_metrics_org_time;

DROP INDEX IF EXISTS idx_user_sessions_user_time;
DROP INDEX IF EXISTS idx_user_sessions_org_time;

DROP INDEX IF EXISTS idx_agent_interactions_agent_time;
DROP INDEX IF EXISTS idx_agent_interactions_user_time;
DROP INDEX IF EXISTS idx_agent_interactions_org_time;

DROP INDEX IF EXISTS idx_command_executions_command_time;
DROP INDEX IF EXISTS idx_command_executions_team_time;
DROP INDEX IF EXISTS idx_command_executions_user_time;
DROP INDEX IF EXISTS idx_command_executions_org_time;

DROP INDEX IF EXISTS idx_team_memberships_team_user;
DROP INDEX IF EXISTS idx_teams_org_name;
DROP INDEX IF EXISTS idx_users_org_email;

-- Drop hypertables (this will also drop the tables)
DROP TABLE IF EXISTS productivity_metrics CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;  
DROP TABLE IF EXISTS agent_interactions CASCADE;
DROP TABLE IF EXISTS command_executions CASCADE;

-- Drop regular tables
DROP TABLE IF EXISTS team_memberships CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;