# Database Schema

This is the database schema implementation for the spec detailed in @.agent-os/specs/2025-09-03-external-metrics-service-#8/spec.md

> Created: 2025-09-03
> Version: 1.0.0

## Multi-Tenant Architecture

### Tenant Isolation Strategy
The database uses PostgreSQL Row-Level Security (RLS) policies to ensure complete data isolation between organizations. Each table includes an `organization_id` column with RLS policies that automatically filter data based on the authenticated user's organization context.

### Data Partitioning
Time-series metrics tables are partitioned by date ranges (monthly partitions) to optimize query performance and enable efficient data archiving. This approach supports automatic partition pruning for date-range queries and simplifies data retention management.

## Core Schema Changes

### Organizations Table (Primary Tenant Entity)
```sql
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    settings JSONB NOT NULL DEFAULT '{}',
    data_retention_days INTEGER NOT NULL DEFAULT 365,
    max_users INTEGER,
    max_teams INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
```

### Users and Authentication
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'manager', 'developer')),
    external_id VARCHAR(255), -- For SSO integration
    settings JSONB NOT NULL DEFAULT '{}',
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, email)
);

CREATE INDEX idx_users_org_email ON users(organization_id, email);
CREATE INDEX idx_users_external_id ON users(external_id) WHERE external_id IS NOT NULL;

-- Row-level security policy
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_isolation ON users 
    USING (organization_id = current_setting('app.current_organization_id')::UUID);
```

### Teams and Team Memberships
```sql
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    settings JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, name)
);

CREATE TABLE team_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'member' CHECK (role IN ('lead', 'member')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(team_id, user_id)
);

CREATE INDEX idx_teams_organization ON teams(organization_id);
CREATE INDEX idx_team_memberships_team ON team_memberships(team_id);
CREATE INDEX idx_team_memberships_user ON team_memberships(user_id);

-- Row-level security policies
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY teams_isolation ON teams 
    USING (organization_id = current_setting('app.current_organization_id')::UUID);

ALTER TABLE team_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY team_memberships_isolation ON team_memberships 
    USING (organization_id = current_setting('app.current_organization_id')::UUID);
```

### Projects and Assignments
```sql
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    repository_url VARCHAR(500),
    settings JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'paused')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, team_id, name)
);

CREATE INDEX idx_projects_team ON projects(team_id);
CREATE INDEX idx_projects_status ON projects(status) WHERE status = 'active';

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY projects_isolation ON projects 
    USING (organization_id = current_setting('app.current_organization_id')::UUID);
```

## Time-Series Metrics Storage

### Productivity Metrics (Partitioned by Month)
```sql
CREATE TABLE productivity_metrics (
    id UUID DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    metric_type VARCHAR(100) NOT NULL,
    metric_name VARCHAR(255) NOT NULL,
    metric_value DECIMAL(15,4) NOT NULL,
    metadata JSONB,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (organization_id, timestamp, id)
) PARTITION BY RANGE (timestamp);

-- Create monthly partitions (example for 2025)
CREATE TABLE productivity_metrics_2025_01 PARTITION OF productivity_metrics
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE productivity_metrics_2025_02 PARTITION OF productivity_metrics
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
-- Additional partitions created automatically by partition management

CREATE INDEX idx_productivity_metrics_user_time ON productivity_metrics(user_id, timestamp DESC);
CREATE INDEX idx_productivity_metrics_team_time ON productivity_metrics(team_id, timestamp DESC) WHERE team_id IS NOT NULL;
CREATE INDEX idx_productivity_metrics_type ON productivity_metrics(metric_type, metric_name);
```

### Agent Usage Tracking
```sql
CREATE TABLE agent_usage_metrics (
    id UUID DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    agent_name VARCHAR(100) NOT NULL,
    command_name VARCHAR(100),
    execution_time_ms INTEGER,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    metadata JSONB,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (organization_id, timestamp, id)
) PARTITION BY RANGE (timestamp);

CREATE INDEX idx_agent_usage_user_time ON agent_usage_metrics(user_id, timestamp DESC);
CREATE INDEX idx_agent_usage_agent ON agent_usage_metrics(agent_name, success);
CREATE INDEX idx_agent_usage_performance ON agent_usage_metrics(execution_time_ms) WHERE execution_time_ms IS NOT NULL;
```

### Task Completion and Velocity
```sql
CREATE TABLE task_metrics (
    id UUID DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    task_type VARCHAR(100) NOT NULL,
    task_status VARCHAR(50) NOT NULL,
    completion_time_seconds INTEGER,
    lines_of_code INTEGER,
    files_modified INTEGER,
    quality_score DECIMAL(5,2),
    metadata JSONB,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (organization_id, timestamp, id)
) PARTITION BY RANGE (timestamp);

CREATE INDEX idx_task_metrics_user_time ON task_metrics(user_id, timestamp DESC);
CREATE INDEX idx_task_metrics_project_time ON task_metrics(project_id, timestamp DESC) WHERE project_id IS NOT NULL;
CREATE INDEX idx_task_metrics_type_status ON task_metrics(task_type, task_status);
```

## Configuration and Preferences

### Dashboard Layouts and Widgets
```sql
CREATE TABLE dashboard_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL for team/org defaults
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE, -- NULL for user/org defaults
    name VARCHAR(255) NOT NULL,
    layout JSONB NOT NULL, -- Widget positions and configurations
    filters JSONB NOT NULL DEFAULT '{}',
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_dashboard_configs_user ON dashboard_configurations(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_dashboard_configs_team ON dashboard_configurations(team_id) WHERE team_id IS NOT NULL;
CREATE INDEX idx_dashboard_configs_default ON dashboard_configurations(organization_id, is_default) WHERE is_default = true;

ALTER TABLE dashboard_configurations ENABLE ROW LEVEL SECURITY;
CREATE POLICY dashboard_configurations_isolation ON dashboard_configurations 
    USING (organization_id = current_setting('app.current_organization_id')::UUID);
```

### Alert Rules and Notifications
```sql
CREATE TABLE alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    metric_query JSONB NOT NULL, -- Query definition for the alert condition
    condition_operator VARCHAR(20) NOT NULL CHECK (condition_operator IN ('>', '<', '>=', '<=', '=', '!=')),
    condition_value DECIMAL(15,4) NOT NULL,
    notification_channels JSONB NOT NULL DEFAULT '[]', -- Email, Slack, etc.
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_alert_rules_active ON alert_rules(organization_id, is_active) WHERE is_active = true;

ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY alert_rules_isolation ON alert_rules 
    USING (organization_id = current_setting('app.current_organization_id')::UUID);
```

## Migration Strategy

### Data Migration Status Tracking
```sql
CREATE TABLE migration_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    migration_type VARCHAR(100) NOT NULL,
    source_data_path VARCHAR(500),
    total_records INTEGER,
    migrated_records INTEGER NOT NULL DEFAULT 0,
    failed_records INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
    error_details JSONB,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_migration_status_org ON migration_status(organization_id, status);
```

### Local to Multi-Tenant Mapping
```sql
CREATE TABLE local_data_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    local_identifier VARCHAR(255) NOT NULL, -- Original local data identifier
    entity_type VARCHAR(100) NOT NULL, -- 'user', 'project', 'metric', etc.
    new_entity_id UUID NOT NULL, -- Mapped UUID in new system
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, local_identifier, entity_type)
);

CREATE INDEX idx_local_data_mapping_identifier ON local_data_mapping(organization_id, local_identifier);
```

## Performance Optimizations

### Indexes for Common Queries
```sql
-- Time-series queries with user filtering
CREATE INDEX CONCURRENTLY idx_productivity_metrics_user_type_time 
    ON productivity_metrics(user_id, metric_type, timestamp DESC);

-- Team aggregation queries
CREATE INDEX CONCURRENTLY idx_productivity_metrics_team_type_time 
    ON productivity_metrics(team_id, metric_type, timestamp DESC) WHERE team_id IS NOT NULL;

-- Cross-team comparison queries
CREATE INDEX CONCURRENTLY idx_productivity_metrics_org_type_time 
    ON productivity_metrics(organization_id, metric_type, timestamp DESC);

-- Agent performance queries
CREATE INDEX CONCURRENTLY idx_agent_usage_performance_time 
    ON agent_usage_metrics(agent_name, timestamp DESC) WHERE success = true;
```

### Automated Partition Management
```sql
-- Function to create monthly partitions automatically
CREATE OR REPLACE FUNCTION create_monthly_partition(table_name TEXT, start_date DATE)
RETURNS VOID AS $$
DECLARE
    partition_name TEXT;
    end_date DATE;
BEGIN
    partition_name := table_name || '_' || to_char(start_date, 'YYYY_MM');
    end_date := start_date + INTERVAL '1 month';
    
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF %I
                    FOR VALUES FROM (%L) TO (%L)',
                   partition_name, table_name, start_date, end_date);
END;
$$ LANGUAGE plpgsql;

-- Scheduled partition creation (to be called monthly)
SELECT create_monthly_partition('productivity_metrics', date_trunc('month', CURRENT_DATE + INTERVAL '1 month'));
SELECT create_monthly_partition('agent_usage_metrics', date_trunc('month', CURRENT_DATE + INTERVAL '1 month'));
SELECT create_monthly_partition('task_metrics', date_trunc('month', CURRENT_DATE + INTERVAL '1 month'));
```

## Data Retention and Archival

### Automated Data Cleanup
```sql
-- Function for data retention enforcement
CREATE OR REPLACE FUNCTION cleanup_old_metrics()
RETURNS INTEGER AS $$
DECLARE
    org_record RECORD;
    cutoff_date DATE;
    deleted_count INTEGER := 0;
BEGIN
    FOR org_record IN SELECT id, data_retention_days FROM organizations LOOP
        cutoff_date := CURRENT_DATE - (org_record.data_retention_days || ' days')::INTERVAL;
        
        DELETE FROM productivity_metrics 
        WHERE organization_id = org_record.id 
        AND timestamp < cutoff_date;
        
        GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;
    END LOOP;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
```

All schema changes include proper indexing for time-series queries, row-level security for multi-tenancy, and partition management for scalability.